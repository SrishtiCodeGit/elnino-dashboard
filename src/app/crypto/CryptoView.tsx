"use client";

import { PageHeader, SectionLabel, SourceBadge, Kpi, Callout, Card } from "@/components/ui";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { BarComparisonChart } from "@/components/charts/BarComparisonChart";
import { COLOR } from "@/lib/theme";
import type { CryptoRecord, ElNinoEvent } from "@/lib/dataUtils";
import type { LiveQuote } from "@/lib/liveQuotes";

function safe1yChange(vals: number[]): number {
  const clean = vals.filter((v) => v != null);
  if (clean.length < 2) return 0;
  const n = Math.min(365, clean.length - 1);
  return (clean[clean.length - 1] / clean[clean.length - 1 - n] - 1) * 100;
}

export function CryptoView({
  crypto,
  elNinoEvents,
  volatilityByPhase,
  correlation,
  live,
}: {
  crypto: CryptoRecord[];
  elNinoEvents: ElNinoEvent[];
  volatilityByPhase: { phase: string; avgVol: number }[];
  correlation: { phase: string; corr: number }[];
  live: Record<string, LiveQuote>;
}) {
  const btcVals = crypto.map((c) => c.BTC_price).filter((v): v is number => v != null);
  const ethVals = crypto.map((c) => c.ETH_price).filter((v): v is number => v != null);
  const btcLive = live["BTC-USD"];
  const ethLive = live["ETH-USD"];

  const btcPrice = btcLive?.price ?? btcVals.at(-1) ?? 0;
  const ethPrice = ethLive?.price ?? ethVals.at(-1) ?? 0;
  const btc1y = btcLive?.changePercent ?? safe1yChange(btcVals);
  const eth1y = ethLive?.changePercent ?? safe1yChange(ethVals);

  const volColors = volatilityByPhase.map(
    (v) => (v.phase === "El Nino" ? COLOR.elNinoDeep : v.phase === "La Nina" ? COLOR.laNinaStrong : COLOR.neutral)
  );
  const corrColors = correlation.map((c) => (c.phase === "El Nino" ? COLOR.elNinoDeep : COLOR.neutral));

  return (
    <div className="px-6 lg:px-12 py-8 max-w-[1400px]">
      <PageHeader
        title="Cryptocurrency Markets"
        subtitle="Bitcoin and Ethereum price behavior during El Nino events, exploratory analysis (2013-present)"
      />

      <Callout tone="warning">
        <strong className="text-text-primary">Methodological Note:</strong> Only the 2015-16 and
        2023-24 El Nino events overlap with mature cryptocurrency markets. All results are
        preliminary findings.
      </Callout>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <Kpi label="Bitcoin (BTC)" value={`$${btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={btcLive?.price ? "live" : "USD"} />
        <Kpi label="Ethereum (ETH)" value={ethPrice ? `$${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "N/A"} sub={ethLive?.price ? "live" : "USD"} />
        <Kpi label="BTC 1-Year" value={`${btc1y >= 0 ? "+" : ""}${btc1y.toFixed(1)}%`} color={btc1y >= 0 ? "positive" : "negative"} sub="Trailing 365 days" />
        <Kpi label="ETH 1-Year" value={`${eth1y >= 0 ? "+" : ""}${eth1y.toFixed(1)}%`} color={eth1y >= 0 ? "positive" : "negative"} sub="Trailing 365 days" />
      </div>

      <SectionLabel>Bitcoin &amp; Ethereum Price History &middot; Shaded = El Nino Windows</SectionLabel>
      <Card>
        <TimeSeriesChart
          data={crypto.map((c) => ({ date: c.date, BTC_price: c.BTC_price, ETH_price: c.ETH_price }))}
          series={[
            { key: "BTC_price", name: "Bitcoin", color: COLOR.amber, yAxisId: "left" },
            { key: "ETH_price", name: "Ethereum", color: COLOR.laNinaStrong, yAxisId: "right" },
          ]}
          elNinoEvents={elNinoEvents}
          height={340}
          yLabel="BTC (USD)"
          yLabelRight="ETH (USD)"
          showLegend
          valueFormatter={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <SourceBadge sources={["Yahoo Finance via yfinance: BTC-USD, ETH-USD (2013-present)"]} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <SectionLabel>BTC 30-Day Realised Volatility by ENSO Phase</SectionLabel>
          <BarComparisonChart
            data={volatilityByPhase}
            xKey="phase"
            series={[{ key: "avgVol", name: "Avg Annualized Volatility", color: COLOR.amber }]}
            perBarColors={volColors}
            valueFormatter={(v) => `${v.toFixed(1)}%`}
            yLabel="Annualized Volatility (%)"
          />
          <SourceBadge sources={["Yahoo Finance (BTC-USD)", "NOAA ONI Dataset"]} />
        </Card>

        <Card>
          <SectionLabel>BTC vs S&amp;P 500: Correlation by ENSO Phase</SectionLabel>
          <BarComparisonChart
            data={correlation}
            xKey="phase"
            series={[{ key: "corr", name: "Pearson Correlation", color: COLOR.laNinaStrong }]}
            perBarColors={corrColors}
            valueFormatter={(v) => v.toFixed(3)}
            yLabel="Pearson Correlation"
          />
          <SourceBadge sources={["Yahoo Finance (BTC-USD, ^GSPC)", "NOAA ONI Dataset"]} />
        </Card>
      </div>
    </div>
  );
}
