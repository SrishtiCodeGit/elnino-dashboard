import { getFinancialMarkets, getElNinoEvents, getRecessions, getRecessionRanges, downsample } from "@/lib/data";
import { getLiveQuotes, TICKERS } from "@/lib/liveQuotes";
import { InsuranceView } from "./InsuranceView";

// Live quotes must be fetched fresh per request, not baked in at build time.
export const dynamic = "force-dynamic";

export default async function InsurancePage() {
  const fin = getFinancialMarkets();
  const events = getElNinoEvents();
  const recessions = getRecessionRanges(getRecessions());

  const ins = fin.filter((f) => f.Insurance_ETF != null);
  const bank = fin.filter((f) => f.Banking_ETF != null);
  const startDate = [ins[0]?.date, bank[0]?.date].filter(Boolean).sort().at(-1) ?? fin[0]?.date;

  const trimmed = fin.filter((f) => f.date >= startDate);
  const base = {
    ins: trimmed.find((f) => f.Insurance_ETF != null)?.Insurance_ETF ?? 1,
    bank: trimmed.find((f) => f.Banking_ETF != null)?.Banking_ETF ?? 1,
    sp: trimmed.find((f) => f.SP500 != null)?.SP500 ?? 1,
  };
  const indexed = trimmed.map((f) => ({
    date: f.date,
    Insurance: f.Insurance_ETF != null ? (f.Insurance_ETF / base.ins) * 100 : null,
    Banking: f.Banking_ETF != null ? (f.Banking_ETF / base.bank) * 100 : null,
    SP500: f.SP500 != null ? (f.SP500 / base.sp) * 100 : null,
  }));

  const totalReturnByEvent = events
    .map((ev) => {
      const rows = fin.filter((f) => f.date >= ev.start && f.date <= ev.end);
      const calc = (key: "Insurance_ETF" | "Banking_ETF" | "SP500") => {
        const vals = rows.map((r) => r[key]).filter((v): v is number => v != null);
        if (vals.length < 20) return null;
        return Number(((vals[vals.length - 1] / vals[0] - 1) * 100).toFixed(1));
      };
      return {
        event: ev.label,
        Insurance: calc("Insurance_ETF"),
        Banking: calc("Banking_ETF"),
        SP500: calc("SP500"),
      };
    })
    .filter((r) => r.Insurance != null || r.Banking != null || r.SP500 != null);

  const live = await getLiveQuotes([TICKERS.insurance, TICKERS.banking, TICKERS.sp500]);

  return (
    <InsuranceView
      fin={fin}
      elNinoEvents={events}
      recessionRanges={recessions}
      indexed={downsample(indexed, 800)}
      startDate={startDate}
      totalReturnByEvent={totalReturnByEvent}
      live={live}
    />
  );
}
