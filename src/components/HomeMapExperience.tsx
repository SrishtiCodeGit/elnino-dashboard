"use client";

import { useState } from "react";
import { UsMap3D } from "@/components/map3d/UsMap3D";
import { StatePanel } from "@/components/StatePanel";
import { NationalRiskPulse } from "@/components/NationalRiskPulse";
import { STATE_BY_ABBR } from "@/lib/states";
import type { StateImpact, CommodityRecord, ElNinoEvent, BondRecord, NationalPulse } from "@/lib/dataUtils";
import type { Topology } from "topojson-specification";

export function HomeMapExperience({
  topology,
  impactByAbbr,
  commodities,
  bonds,
  elNinoEvents,
  pulse,
  pulseIsLive,
}: {
  topology: Topology;
  impactByAbbr: Record<string, StateImpact>;
  commodities: CommodityRecord[];
  bonds: BondRecord[];
  elNinoEvents: ElNinoEvent[];
  pulse: NationalPulse;
  pulseIsLive: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const stateRef = selected ? STATE_BY_ABBR[selected] : null;

  return (
    <div className="light-cards relative w-full h-screen overflow-hidden bg-bg">
      <UsMap3D
        topology={topology}
        impactByAbbr={impactByAbbr}
        selectedAbbr={selected}
        onSelect={setSelected}
      />

      <NationalRiskPulse pulse={pulse} isLive={pulseIsLive} />

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
