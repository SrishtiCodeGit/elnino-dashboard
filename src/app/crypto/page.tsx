import { getCrypto, getFinancialMarkets, getOni, getElNinoEvents, downsample } from "@/lib/data";
import { getLiveQuotes, TICKERS } from "@/lib/liveQuotes";
import { CryptoView } from "./CryptoView";

// Live quotes must be fetched fresh per request, not baked in at build time.
export const dynamic = "force-dynamic";

/** Binary search for the latest entry with date <= target, given entries sorted ascending by date. */
function asOfLookup<T extends { date: string }>(sorted: T[], date: string): T | null {
  let lo = 0,
    hi = sorted.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].date <= date) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? sorted[ans] : null;
}

function oniForDate(oniSorted: { date: string; ONI: number }[], date: string): number | null {
  return asOfLookup(oniSorted, date)?.ONI ?? null;
}

export default async function CryptoPage() {
  const crypto = getCrypto();
  const fin = getFinancialMarkets();
  const oni = getOni();
  const events = getElNinoEvents();

  // 30-day realised volatility (annualised) by ENSO phase, for BTC.
  const btc = crypto.filter((c) => c.BTC_price != null);
  const rets: { date: string; ret: number }[] = [];
  for (let i = 1; i < btc.length; i++) {
    const prev = btc[i - 1].BTC_price as number;
    const curr = btc[i].BTC_price as number;
    if (prev > 0) rets.push({ date: btc[i].date, ret: curr / prev - 1 });
  }
  const volByPhase = new Map<string, number[]>();
  const window = 30;
  for (let i = window; i < rets.length; i++) {
    const slice = rets.slice(i - window, i).map((r) => r.ret);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    const vol = Math.sqrt(variance) * Math.sqrt(252) * 100;
    const oniVal = oniForDate(oni, rets[i].date);
    if (oniVal == null) continue;
    const phase = oniVal >= 0.5 ? "El Nino" : oniVal <= -0.5 ? "La Nina" : "Neutral";
    if (!volByPhase.has(phase)) volByPhase.set(phase, []);
    volByPhase.get(phase)!.push(vol);
  }
  const volatilityByPhase = ["El Nino", "Neutral", "La Nina"]
    .filter((p) => volByPhase.has(p))
    .map((p) => {
      const vals = volByPhase.get(p)!;
      return { phase: p, avgVol: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) };
    });

  // Correlation between BTC and S&P 500 daily returns, El Nino vs Neutral.
  const spSorted = fin
    .filter((f) => f.SP500 != null)
    .map((f) => ({ date: f.date, SP500: f.SP500 as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pairs: { btcRet: number; spRet: number; oniVal: number }[] = [];
  for (let i = 1; i < btc.length; i++) {
    const date = btc[i].date;
    const prevSp = asOfLookup(spSorted, btc[i - 1].date)?.SP500;
    const currSp = asOfLookup(spSorted, date)?.SP500;
    if (prevSp == null || currSp == null || prevSp === 0) continue;
    const oniVal = oniForDate(oni, date);
    if (oniVal == null) continue;
    const prevBtc = btc[i - 1].BTC_price as number;
    const currBtc = btc[i].BTC_price as number;
    if (prevBtc === 0) continue;
    pairs.push({ btcRet: currBtc / prevBtc - 1, spRet: currSp / prevSp - 1, oniVal });
  }
  function pearson(rows: { btcRet: number; spRet: number }[]): number | null {
    if (rows.length < 10) return null;
    const n = rows.length;
    const mBtc = rows.reduce((a, r) => a + r.btcRet, 0) / n;
    const mSp = rows.reduce((a, r) => a + r.spRet, 0) / n;
    let num = 0,
      dBtc = 0,
      dSp = 0;
    for (const r of rows) {
      num += (r.btcRet - mBtc) * (r.spRet - mSp);
      dBtc += (r.btcRet - mBtc) ** 2;
      dSp += (r.spRet - mSp) ** 2;
    }
    const denom = Math.sqrt(dBtc * dSp);
    return denom === 0 ? null : num / denom;
  }
  const corrElNino = pearson(pairs.filter((p) => p.oniVal >= 0.5));
  const corrNeutral = pearson(pairs.filter((p) => p.oniVal < 0.5));
  const correlation = [
    corrElNino != null && { phase: "El Nino", corr: Number(corrElNino.toFixed(3)) },
    corrNeutral != null && { phase: "Neutral", corr: Number(corrNeutral.toFixed(3)) },
  ].filter((x): x is { phase: string; corr: number } => !!x);

  const live = await getLiveQuotes([TICKERS.btc, TICKERS.eth]);

  return (
    <CryptoView
      crypto={downsample(crypto, 700)}
      elNinoEvents={events}
      volatilityByPhase={volatilityByPhase}
      correlation={correlation}
      live={live}
    />
  );
}
