"use client";

import { useMemo, useState, useCallback } from "react";
import { UsMap3D } from "@/components/map3d/UsMap3D";
import { StatePanel } from "@/components/StatePanel";
import { TopHeaderBar } from "@/components/TopHeaderBar";
import { RiskTicker } from "@/components/RiskTicker";
import { ExposureControls } from "@/components/ExposureControls";
import { TopRisksModal } from "@/components/TopRisksModal";
import { AgentReportPanel } from "@/components/AgentReportPanel";
import { AgentSentinelPanel } from "@/components/AgentSentinelPanel";
import { SupplyChainReportModal } from "@/components/SupplyChainReportModal";
import { SupplyChainBuildingDetail } from "@/components/SupplyChainBuildingDetail";
import { WildfireRiskSummaryModal } from "@/components/WildfireRiskSummaryModal";
import { WildfireLivestockDetail } from "@/components/WildfireLivestockDetail";
import { STATE_BY_ABBR } from "@/lib/states";
import type {
  StateImpact,
  CommodityRecord,
  ElNinoEvent,
  BondRecord,
  NationalPulse,
  TopRiskItem,
  SupplyChainFlow,
  WildfireStats,
  WildfireYearStats,
  LivestockPriceRecord,
} from "@/lib/dataUtils";
import type { SentinelEvent } from "@/lib/sentinel";
import type { Topology } from "topojson-specification";

export type MapHighlight = { type: "commodity"; value: string } | { type: "topExposure" };

export function HomeMapExperience({
  topology,
  impactByAbbr,
  commodities,
  bonds,
  elNinoEvents,
  pulse,
  pulseIsLive,
  topRisks,
  supplyChainFlows,
  wildfireStats,
  wildfireByYear,
  livestockPrices,
}: {
  topology: Topology;
  impactByAbbr: Record<string, StateImpact>;
  commodities: CommodityRecord[];
  bonds: BondRecord[];
  elNinoEvents: ElNinoEvent[];
  pulse: NationalPulse;
  pulseIsLive: boolean;
  topRisks: TopRiskItem[];
  supplyChainFlows: SupplyChainFlow[];
  wildfireStats: WildfireStats[];
  wildfireByYear: WildfireYearStats[];
  livestockPrices: LivestockPriceRecord[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<MapHighlight | null>(null);
  const [showTopRisks, setShowTopRisks] = useState(false);
  const [showAgentReport, setShowAgentReport] = useState(false);
  const [showSentinel, setShowSentinel] = useState(false);
  const [sentinelEvents, setSentinelEvents] = useState<SentinelEvent[]>([]);
  const pushSentinelEvent = useCallback((event: SentinelEvent) => {
    setSentinelEvents((prev) => [...prev.slice(-49), event]);
  }, []);
  const [showSupplyChain, setShowSupplyChain] = useState(false);
  const [showSupplyChainReport, setShowSupplyChainReport] = useState(false);
  const [buildingDetailAbbr, setBuildingDetailAbbr] = useState<string | null>(null);
  const [showWildfireRisk, setShowWildfireRisk] = useState(false);
  const [showWildfireSummary, setShowWildfireSummary] = useState(false);
  const [wildfireDetailAbbr, setWildfireDetailAbbr] = useState<string | null>(null);
  const stateRef = selected ? STATE_BY_ABBR[selected] : null;

  function handleHighlightChange(next: MapHighlight | null) {
    setHighlight(next);
    if (next) {
      setShowSupplyChain(false);
      setShowSupplyChainReport(false);
      setShowWildfireRisk(false);
      setShowWildfireSummary(false);
    }
  }

  function handleToggleSupplyChain() {
    setShowSupplyChain((prev) => {
      const next = !prev;
      if (next) {
        setHighlight(null);
        setShowWildfireRisk(false);
        setShowWildfireSummary(false);
      } else {
        setShowSupplyChainReport(false);
        setBuildingDetailAbbr(null);
      }
      return next;
    });
  }

  function handleToggleWildfireRisk() {
    setShowWildfireRisk((prev) => {
      const next = !prev;
      if (next) {
        setHighlight(null);
        setShowSupplyChain(false);
        setShowSupplyChainReport(false);
      } else {
        setShowWildfireSummary(false);
        setWildfireDetailAbbr(null);
      }
      return next;
    });
  }

  const supplyChainAbbrs = useMemo(() => {
    const set = new Set<string>();
    for (const f of supplyChainFlows) {
      set.add(f.origin);
      set.add(f.destination);
    }
    return [...set];
  }, [supplyChainFlows]);

  // Only the top 20 states by real acreage get a flame marker on the map —
  // the other ~30 states with only marginal wildfire history would each
  // still carry a full label, flooding the map the same way unfiltered
  // Supply Chain buildings did earlier. The full ranked list stays
  // available in the "See Details" summary table.
  const topWildfireStats = useMemo(
    () =>
      [...wildfireStats]
        .filter((s) => s.avgAnnualAcres > 0)
        .sort((a, b) => b.avgAnnualAcres - a.avgAnnualAcres)
        .slice(0, 20),
    [wildfireStats]
  );

  const wildfireAbbrs = useMemo(() => topWildfireStats.map((s) => s.abbr), [topWildfireStats]);

  const highlightedAbbrs = useMemo<string[] | null>(() => {
    if (showSupplyChain) return supplyChainAbbrs;
    if (showWildfireRisk) return wildfireAbbrs;
    if (!highlight) return null;
    if (highlight.type === "topExposure") return pulse.topStates.map((s) => s.abbr);
    return Object.values(impactByAbbr)
      .filter((s) => s.keyCommodities.includes(highlight.value))
      .map((s) => s.abbr);
  }, [highlight, showSupplyChain, supplyChainAbbrs, showWildfireRisk, wildfireAbbrs, impactByAbbr, pulse.topStates]);

  const allStates = useMemo(
    () => Object.values(impactByAbbr).sort((a, b) => a.state.localeCompare(b.state)),
    [impactByAbbr]
  );

  const highlightCommodity = highlight?.type === "commodity" ? highlight.value : null;

  return (
    <div className="light-cards relative flex flex-col w-full h-screen overflow-hidden bg-bg">
      <TopHeaderBar pulse={pulse} isLive={pulseIsLive} />
      <RiskTicker items={topRisks} onSelect={setSelected} />

      <div className="relative flex-1 min-h-0">
        <UsMap3D
          topology={topology}
          impactByAbbr={impactByAbbr}
          selectedAbbr={selected}
          onSelect={setSelected}
          highlightedAbbrs={highlightedAbbrs}
          highlightCommodity={highlightCommodity}
          supplyChainFlows={showSupplyChain ? supplyChainFlows : null}
          onSupplyChainBuildingSelect={setBuildingDetailAbbr}
          wildfireStats={showWildfireRisk ? topWildfireStats : null}
          onWildfireMarkerSelect={setWildfireDetailAbbr}
          activeWildfireAbbr={wildfireDetailAbbr}
        />

        <div className="absolute top-4 left-4 z-10 w-64">
          <ExposureControls
            pulse={pulse}
            highlight={highlight}
            onHighlightChange={handleHighlightChange}
            onOpenTopRisks={() => setShowTopRisks(true)}
            onOpenReport={() => setShowAgentReport(true)}
            showSupplyChain={showSupplyChain}
            onToggleSupplyChain={handleToggleSupplyChain}
            showWildfireRisk={showWildfireRisk}
            onToggleWildfireRisk={handleToggleWildfireRisk}
            showSentinel={showSentinel}
            onToggleSentinel={() => setShowSentinel((v) => !v)}
          />
        </div>

        {showSupplyChain && (
          <button
            onClick={() => setShowSupplyChainReport(true)}
            className="hud-card absolute bottom-16 left-1/2 -translate-x-1/2 z-10 rounded-full px-5 py-2 shadow-2xl font-mono font-bold text-[0.72rem] uppercase tracking-wide text-[#1E293B] bg-[#FBBF24] hover:bg-[#FCD34D] transition-colors"
          >
            See Details
          </button>
        )}

        {showWildfireRisk && (
          <button
            onClick={() => setShowWildfireSummary(true)}
            className="hud-card absolute bottom-16 left-1/2 -translate-x-1/2 z-10 rounded-full px-5 py-2 shadow-2xl font-mono font-bold text-[0.72rem] uppercase tracking-wide text-[#1E293B] bg-[#FBBF24] hover:bg-[#FCD34D] transition-colors"
          >
            See Details
          </button>
        )}
      </div>

      {showTopRisks && (
        <TopRisksModal items={topRisks} onSelect={setSelected} onClose={() => setShowTopRisks(false)} />
      )}

      {showAgentReport && (
        <AgentReportPanel
          states={allStates}
          pulse={pulse}
          onClose={() => setShowAgentReport(false)}
          pushEvent={pushSentinelEvent}
        />
      )}

      {showSentinel && (
        <AgentSentinelPanel events={sentinelEvents} pushEvent={pushSentinelEvent} onClose={() => setShowSentinel(false)} />
      )}

      {showSupplyChainReport && (
        <SupplyChainReportModal
          flows={supplyChainFlows}
          statesByAbbr={impactByAbbr}
          onSelect={setSelected}
          onClose={() => setShowSupplyChainReport(false)}
        />
      )}

      {buildingDetailAbbr && (
        <SupplyChainBuildingDetail
          abbr={buildingDetailAbbr}
          impact={impactByAbbr[buildingDetailAbbr]}
          flows={supplyChainFlows}
          onClose={() => setBuildingDetailAbbr(null)}
        />
      )}

      {showWildfireSummary && (
        <WildfireRiskSummaryModal
          stats={wildfireStats}
          wildfireByYear={wildfireByYear}
          livestockPrices={livestockPrices}
          impactByAbbr={impactByAbbr}
          onSelect={setSelected}
          onClose={() => setShowWildfireSummary(false)}
        />
      )}

      {wildfireDetailAbbr &&
        (() => {
          const stats = wildfireStats.find((s) => s.abbr === wildfireDetailAbbr);
          if (!stats) return null;
          const maxAcres = Math.max(1, ...wildfireStats.map((s) => s.avgAnnualAcres));
          return (
            <WildfireLivestockDetail
              abbr={wildfireDetailAbbr}
              impact={impactByAbbr[wildfireDetailAbbr]}
              wildfire={stats}
              maxAcres={maxAcres}
              commodities={commodities}
              livestockPrices={livestockPrices}
              onClose={() => setWildfireDetailAbbr(null)}
            />
          );
        })()}

      {stateRef && (
        <StatePanel
          stateRef={stateRef}
          impact={impactByAbbr[stateRef.abbr] ?? null}
          commodities={commodities}
          bonds={bonds}
          elNinoEvents={elNinoEvents}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
