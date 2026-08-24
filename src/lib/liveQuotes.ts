import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface LiveQuote {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  marketTime: string | null;
}

/** Server-side only. Fetches a real-time snapshot for the given tickers. */
export async function getLiveQuotes(symbols: string[]): Promise<Record<string, LiveQuote>> {
  const out: Record<string, LiveQuote> = {};
  try {
    const results = await yf.quote(symbols);
    const arr = Array.isArray(results) ? results : [results];
    for (const r of arr) {
      out[r.symbol] = {
        symbol: r.symbol,
        price: r.regularMarketPrice ?? null,
        changePercent: r.regularMarketChangePercent ?? null,
        marketTime: r.regularMarketTime ? new Date(r.regularMarketTime).toISOString() : null,
      };
    }
  } catch (e) {
    console.error("getLiveQuotes failed:", (e as Error).message);
  }
  return out;
}

export const TICKERS = {
  sp500: "^GSPC",
  vix: "^VIX",
  dow: "^DJI",
  tnx: "^TNX",
  tyx: "^TYX",
  btc: "BTC-USD",
  eth: "ETH-USD",
  insurance: "KIE",
  banking: "KBE",
  wheat: "ZW=F",
  corn: "ZC=F",
  coffee: "KC=F",
  cocoa: "CC=F",
  crude: "CL=F",
  gold: "GC=F",
  natgas: "NG=F",
} as const;
