import {
  getFinancialMarkets,
  getOni,
  getBonds,
  getElNinoEvents,
  getRecessions,
  getRecessionRanges,
  quarterlyPhaseReturns,
} from "@/lib/data";
import { getLiveQuotes, TICKERS } from "@/lib/liveQuotes";
import { MarketsView } from "./MarketsView";

// Live quotes must be fetched fresh per request, not baked in at build time.
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const fin = getFinancialMarkets();
  const bonds = getBonds();
  const oni = getOni();
  const events = getElNinoEvents();
  const recessions = getRecessionRanges(getRecessions());

  const spReturns = quarterlyPhaseReturns(
    fin.map((r) => ({ date: r.date, value: r.SP500 })),
    oni
  );

  const live = await getLiveQuotes([
    TICKERS.sp500,
    TICKERS.vix,
    TICKERS.dow,
    TICKERS.tnx,
    TICKERS.tyx,
  ]);

  return (
    <MarketsView
      fin={fin}
      bonds={bonds}
      elNinoEvents={events}
      recessionRanges={recessions}
      spReturns={spReturns}
      live={live}
    />
  );
}
