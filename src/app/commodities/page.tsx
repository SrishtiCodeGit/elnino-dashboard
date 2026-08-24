import { getCommodities, getOni, getElNinoEvents, elNinoVsNeutralReturn } from "@/lib/data";
import { getLiveQuotes, TICKERS } from "@/lib/liveQuotes";
import { CommoditiesView } from "./CommoditiesView";

// Live quotes must be fetched fresh per request, not baked in at build time.
export const dynamic = "force-dynamic";

const COMM_MAP: Record<string, { name: string; color: string; ticker: string }> = {
  Wheat_Futures: { name: "Wheat", color: "#F59E0B", ticker: TICKERS.wheat },
  Corn_Futures: { name: "Corn", color: "#EAB308", ticker: TICKERS.corn },
  Coffee_Futures: { name: "Coffee", color: "#92400E", ticker: TICKERS.coffee },
  Cocoa_Futures: { name: "Cocoa", color: "#7C3AED", ticker: TICKERS.cocoa },
  CrudeOil_Futures: { name: "Crude Oil", color: "#38BDF8", ticker: TICKERS.crude },
  Gold_Futures: { name: "Gold", color: "#FBBF24", ticker: TICKERS.gold },
  NatGas_Futures: { name: "Natural Gas", color: "#34D399", ticker: TICKERS.natgas },
};

export default async function CommoditiesPage() {
  const comm = getCommodities();
  const oni = getOni();
  const events = getElNinoEvents();

  const comparison = Object.entries(COMM_MAP)
    .map(([key, meta]) => {
      const r = elNinoVsNeutralReturn(
        comm.map((c) => ({ date: c.date, value: c[key as keyof typeof c] as number | null })),
        oni
      );
      if (!r) return null;
      return {
        commodity: meta.name,
        elNino: r.elNino != null ? Number(r.elNino.toFixed(2)) : null,
        neutral: r.neutral != null ? Number(r.neutral.toFixed(2)) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.elNino ?? -Infinity) - (a.elNino ?? -Infinity));

  const live = await getLiveQuotes(Object.values(COMM_MAP).map((m) => m.ticker));

  return (
    <CommoditiesView
      commodities={comm}
      commMap={COMM_MAP}
      elNinoEvents={events}
      comparison={comparison}
      live={live}
    />
  );
}
