"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { feature } from "topojson-client";
import { geoPath, geoAlbersUsa } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { STATE_BY_FIPS } from "@/lib/states";
import { riskColor } from "@/lib/theme";
import type { StateImpact, SupplyChainFlow, WildfireStats } from "@/lib/dataUtils";
import { StateMesh } from "./StateMesh";
import { LandPad } from "./LandPad";
import { SupplyChainFlows } from "./SupplyChainFlows";
import { SupplyChainBuildings } from "./SupplyChainBuildings";
import { StateLandscape } from "./StateLandscape";
import { CommodityDecoration, type DecoratedCommodity } from "./CommodityDecoration";
import { WildfireMarkers } from "./WildfireMarkers";
import { FinancialRiskMarkers } from "./FinancialRiskMarkers";
import { CountUpNumber } from "@/components/CountUpNumber";

const DECORATED_COMMODITIES = new Set<DecoratedCommodity>(["Cattle", "Wheat", "Corn", "Soybeans"]);
function asDecoratedCommodity(value: string | null | undefined): DecoratedCommodity | null {
  return value != null && DECORATED_COMMODITIES.has(value as DecoratedCommodity) ? (value as DecoratedCommodity) : null;
}

interface Props {
  topology: Topology;
  impactByAbbr: Record<string, StateImpact>;
  selectedAbbr?: string | null;
  onSelect: (abbr: string) => void;
  highlightedAbbrs?: string[] | null;
  highlightCommodity?: string | null;
  supplyChainFlows?: SupplyChainFlow[] | null;
  onSupplyChainBuildingSelect?: (abbr: string) => void;
  wildfireStats?: WildfireStats[] | null;
  onWildfireMarkerSelect?: (abbr: string) => void;
  activeWildfireAbbr?: string | null;
  financialRiskActive?: boolean;
}

interface HoverInfo {
  x: number;
  y: number;
  abbr: string;
  name: string;
  impact?: StateImpact;
}

const NO_DATA_HEIGHT = 2.5;
const NO_DATA_COLOR = "#475569";
// Flat, uncolored terrain used only while the Supply Chain Risk view is
// active — severity is carried by the building glyphs and flow arcs
// instead, so there's one color language on screen, not a terrain
// gradient competing with them. Dark slate grey — paired with LandPad's
// normal green base and the blue dashed outline, which is the combination
// that read best.
const SUPPLY_CHAIN_TERRAIN_COLOR = "#334155";
// Wildfire & Livestock Risk view: a distinct dark charcoal/ash tone
// (warm-neutral, not the Supply Chain view's cool slate) so the two flat
// terrain views don't read as the same mode, and the ember-colored flame
// markers still pop against it.
const WILDFIRE_TERRAIN_COLOR = "#2A2420";
// Financial Risk view: one flat warm-yellow tone for every state instead of
// the full green-to-red heatmap gradient — severity is carried entirely by
// the red rod markers (FinancialRiskMarkers) on Severe-band states instead
// of terrain color, same "one signal per view" reasoning as the other two
// flat-terrain modes above.
const FINANCIAL_RISK_TERRAIN_COLOR = "#EAB308";
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 46;

// Mirrors severityLabel() in lib/dataUtils.ts — keep the bands in sync.
const RISK_BANDS = [
  { label: "Low", range: "0–24", score: 12 },
  { label: "Moderate", range: "25–49", score: 37 },
  { label: "High", range: "50–74", score: 62 },
  { label: "Severe", range: "75–100", score: 87 },
] as const;

const SCENE_BG = "#05070D";

const DEFAULT_CAM_POS: [number, number, number] = [0, 820, 1060];
const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];
const ZOOM_OFFSET: [number, number, number] = [0, 190, 260];

const WATER_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Broad, slow-drifting blended bands (few large repeats, soft transitions)
// instead of a tight sine grid — reads as smooth "velvety" folds of dark
// blue rather than a mechanical ripple pattern. No bright highlight color:
// every tone stays within the dark-blue palette.
const WATER_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 6.0;
    float a = sin(p.x * 1.3 + p.y * 0.6 + uTime * 0.05);
    float b = sin(p.x * 0.7 - p.y * 1.1 + uTime * 0.035 + 1.5);
    float c = sin(p.x * 0.4 + p.y * 1.7 - uTime * 0.025 + 3.0);
    float n = (a + b + c) / 3.0;
    float t = smoothstep(-0.5, 0.6, n);
    vec3 color = mix(uDeep, uMid, t);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Slow, velvety animated ocean surface — soft drifting dark-blue folds
 * (no particles, no bright highlights) instead of a flat color plane. */
function WaterMaterial() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#050F1F") },
      uMid: { value: new THREE.Color("#123A5E") },
    }),
    []
  );
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <shaderMaterial
      ref={matRef}
      uniforms={uniforms}
      vertexShader={WATER_VERTEX_SHADER}
      fragmentShader={WATER_FRAGMENT_SHADER}
    />
  );
}

const pathGen = geoPath();
// The same composite Albers-USA projection us-atlas used to build the
// topology, so we can invert a clicked/hovered map point back to real
// lon/lat for the HUD coordinate readout.
const projection = geoAlbersUsa();

function heightForScore(score: number | undefined) {
  if (score == null) return NO_DATA_HEIGHT;
  return MIN_HEIGHT + (score / 100) * (MAX_HEIGHT - MIN_HEIGHT);
}

function Scene({
  features,
  center,
  impactByAbbr,
  selectedAbbr,
  hoveredAbbr,
  focusedAbbr,
  onFocus,
  onSelect,
  onHoverChange,
  onHoverMove,
  onWorldMove,
  onAnchorMove,
  controlsRef,
  highlightedAbbrs,
  highlightCommodity,
  supplyChainFlows,
  onSupplyChainBuildingSelect,
  wildfireStats,
  onWildfireMarkerSelect,
  activeWildfireAbbr,
  financialRiskActive,
}: {
  features: Feature[];
  center: [number, number];
  impactByAbbr: Record<string, StateImpact>;
  selectedAbbr?: string | null;
  hoveredAbbr: string | null;
  focusedAbbr: string | null;
  onFocus: (abbr: string | null) => void;
  onSelect: (abbr: string) => void;
  onHoverChange: (info: HoverInfo | null) => void;
  onHoverMove: (x: number, y: number) => void;
  onWorldMove: (x: number, z: number) => void;
  onAnchorMove: (pos: { x: number; y: number } | null) => void;
  controlsRef: React.RefObject<CameraControlsImpl | null>;
  highlightedAbbrs?: string[] | null;
  highlightCommodity?: string | null;
  supplyChainFlows?: SupplyChainFlow[] | null;
  onSupplyChainBuildingSelect?: (abbr: string) => void;
  wildfireStats?: WildfireStats[] | null;
  onWildfireMarkerSelect?: (abbr: string) => void;
  activeWildfireAbbr?: string | null;
  financialRiskActive?: boolean;
}) {
  const highlightSet = useMemo(
    () => (highlightedAbbrs && highlightedAbbrs.length ? new Set(highlightedAbbrs) : null),
    [highlightedAbbrs]
  );
  const { camera, size } = useThree();
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  // Slow ambient rotation while idle — paused the instant a state is
  // focused (clicking a state to see its data should hold still) or the
  // user is actively dragging. Listeners attach lazily on the first frame
  // rather than in a useEffect, since CameraControls is a Canvas sibling
  // and its ref may not be populated yet when Scene's own effects run.
  const isInteractingRef = useRef(false);
  const rotationListenersAttachedRef = useRef(false);
  // One-time establishing shot on load: start wide and high, sweep down
  // close over the landscape so the buildings/forest read clearly, hold
  // briefly, then pull back out to the normal resting overview. Auto-
  // rotation is suppressed while this plays so it doesn't fight the
  // scripted transition.
  const introStartedRef = useRef(false);
  const introPlayingRef = useRef(true);
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (!rotationListenersAttachedRef.current) {
      controls.addEventListener("controlstart", () => {
        isInteractingRef.current = true;
      });
      controls.addEventListener("controlend", () => {
        isInteractingRef.current = false;
      });
      rotationListenersAttachedRef.current = true;
    }
    if (!introStartedRef.current) {
      introStartedRef.current = true;
      (async () => {
        controls.setLookAt(60, 1500, 2000, 0, 0, 0, false);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await controls.setLookAt(140, 130, 230, -10, 15, 10, true);
        await new Promise((resolve) => setTimeout(resolve, 1100));
        await controls.setLookAt(...DEFAULT_CAM_POS, ...DEFAULT_TARGET, true);
        introPlayingRef.current = false;
      })();
    }
    if (!focusedAbbr && !isInteractingRef.current && !introPlayingRef.current) {
      controls.rotate(((Math.PI * 2) / 120) * delta, 0, false);
    }
  });

  // Per-state projected centroid + risk height, reused for both the
  // click-to-zoom camera target and the hover "target lock" connector line.
  const meta = useMemo(() => {
    const map = new Map<string, { cx: number; cz: number; height: number }>();
    for (const f of features) {
      const fips = String(f.id);
      const ref = STATE_BY_FIPS[fips];
      if (!ref) continue;
      const c = pathGen.centroid(f) as [number, number];
      const impact = impactByAbbr[ref.abbr];
      map.set(ref.abbr, {
        cx: c[0] - center[0],
        cz: c[1] - center[1],
        height: heightForScore(impact?.financialRiskScore),
      });
    }
    return map;
  }, [features, impactByAbbr, center]);

  useFrame(() => {
    if (!hoveredAbbr) return;
    const m = meta.get(hoveredAbbr);
    if (!m) return;
    tmpVec.set(m.cx, m.height + 2, m.cz).project(camera);
    onAnchorMove({
      x: (tmpVec.x * 0.5 + 0.5) * size.width,
      y: (1 - (tmpVec.y * 0.5 + 0.5)) * size.height,
    });
  });

  const supplyChainActive = !!supplyChainFlows && supplyChainFlows.length > 0;
  const wildfireActive = !!wildfireStats && wildfireStats.length > 0;
  const flatTerrainActive = supplyChainActive || wildfireActive;
  const decoratedCommodity = asDecoratedCommodity(highlightCommodity);

  return (
    <group position={[-center[0], 0, -center[1]]}>
      {features.map((f) => {
        const fips = String(f.id);
        const ref = STATE_BY_FIPS[fips];
        const impact = ref ? impactByAbbr[ref.abbr] : undefined;
        const color = wildfireActive
          ? WILDFIRE_TERRAIN_COLOR
          : supplyChainActive
            ? SUPPLY_CHAIN_TERRAIN_COLOR
            : financialRiskActive
              ? FINANCIAL_RISK_TERRAIN_COLOR
              : impact
                ? riskColor(impact.financialRiskScore)
                : NO_DATA_COLOR;
        const height = heightForScore(impact?.financialRiskScore);
        if (!ref) return null;

        const m = meta.get(ref.abbr);
        const isFocused = focusedAbbr === ref.abbr;
        const isHighlighted = highlightSet?.has(ref.abbr) ?? false;
        const dimmed = focusedAbbr != null ? !isFocused : highlightSet != null && !isHighlighted;

        return (
          <group key={fips}>
            <LandPad geometry={f.geometry as Geometry} />
            <StateMesh
              geometry={f.geometry as Geometry}
              height={height}
              color={color}
              riskScore={impact?.financialRiskScore}
              isHovered={hoveredAbbr === ref.abbr}
              isSelected={selectedAbbr === ref.abbr}
              isHighlighted={isHighlighted}
              dimmed={dimmed}
              disableGlow={flatTerrainActive || financialRiskActive}
              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onHoverChange({
                  x: e.clientX,
                  y: e.clientY,
                  abbr: ref.abbr,
                  name: ref.name,
                  impact,
                });
                document.body.style.cursor = "pointer";
              }}
              onPointerLeave={() => {
                onHoverChange(null);
                onAnchorMove(null);
                document.body.style.cursor = "auto";
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                onHoverMove(e.clientX, e.clientY);
                onWorldMove(e.point.x, e.point.z);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (focusedAbbr === ref.abbr) {
                  onSelect(ref.abbr);
                  return;
                }
                onFocus(ref.abbr);
                if (m) {
                  const targetX = m.cx;
                  const targetZ = m.cz;
                  const targetY = height * 0.5;
                  controlsRef.current?.setLookAt(
                    targetX + ZOOM_OFFSET[0],
                    targetY + ZOOM_OFFSET[1],
                    targetZ + ZOOM_OFFSET[2],
                    targetX,
                    targetY,
                    targetZ,
                    true
                  );
                }
              }}
            />
            {isHighlighted && m && !flatTerrainActive && (
              // Html is a child of the group that already translates by
              // -center, so its position prop needs the RAW (pre-offset)
              // centroid — reusing the already-center-subtracted m.cx/cz
              // here double-shifted every label off its actual state.
              <Html
                position={[m.cx + center[0], m.height + 4, m.cz + center[1]]}
                center
                zIndexRange={[1, 0]}
              >
                <div
                  style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "#ffffff",
                    border: "1px solid rgba(15,23,42,0.25)",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#10151c",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {ref.abbr}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Procedural city + forest scattered across every state's real
       * footprint — the base heatmap view only, and not while a commodity
       * filter is showing its own crop/livestock decoration instead. */}
      {!flatTerrainActive && !focusedAbbr && !decoratedCommodity && (
        <StateLandscape features={features} meta={meta} />
      )}

      {/* Cattle/Wheat/Corn/Soybeans highlight: real crop/livestock stand-ins
       * on exactly the states that commodity's real keyCommodities lists —
       * the same highlight set already coloring the terrain — replacing
       * the generic city+forest rather than sitting on top of it. */}
      {decoratedCommodity && !focusedAbbr && highlightedAbbrs && highlightedAbbrs.length > 0 && (
        <CommodityDecoration
          commodity={decoratedCommodity}
          features={features}
          meta={meta}
          abbrs={highlightedAbbrs}
        />
      )}

      {supplyChainFlows && supplyChainFlows.length > 0 && (
        <>
          <SupplyChainBuildings
            flows={supplyChainFlows}
            meta={meta}
            center={center}
            impactByAbbr={impactByAbbr}
            onSelect={onSupplyChainBuildingSelect ?? (() => {})}
          />
          <SupplyChainFlows
            flows={supplyChainFlows}
            meta={meta}
            center={center}
            impactByAbbr={impactByAbbr}
          />
        </>
      )}

      {wildfireStats && wildfireStats.length > 0 && (
        <WildfireMarkers
          stats={wildfireStats}
          meta={meta}
          center={center}
          impactByAbbr={impactByAbbr}
          onSelect={onWildfireMarkerSelect ?? (() => {})}
          activeAbbr={activeWildfireAbbr}
        />
      )}

      {financialRiskActive && (
        <FinancialRiskMarkers states={Object.values(impactByAbbr)} meta={meta} center={center} onSelect={onSelect} />
      )}
    </group>
  );
}

export function UsMap3D({
  topology,
  impactByAbbr,
  selectedAbbr,
  onSelect,
  highlightedAbbrs,
  highlightCommodity,
  supplyChainFlows,
  onSupplyChainBuildingSelect,
  wildfireStats,
  onWildfireMarkerSelect,
  activeWildfireAbbr,
  financialRiskActive,
}: Props) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focusedAbbr, setFocusedAbbr] = useState<string | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [hudLonLat, setHudLonLat] = useState<[number, number] | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const controlsRef = useRef<CameraControlsImpl | null>(null);

  const { features, center } = useMemo(() => {
    const geo = topology.objects.states as GeometryCollection;
    const fc = feature(topology, geo);
    const feats = "features" in fc ? fc.features : [];
    const bbox = topology.bbox ?? [0, 0, 960, 600];
    const c: [number, number] = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    return { features: feats, center: c };
  }, [topology]);

  const handleHoverMove = useCallback((clientX: number, clientY: number) => {
    setHover((prev) => (prev ? { ...prev, x: clientX, y: clientY } : prev));
  }, []);

  const handleWorldMove = useCallback(
    (x: number, z: number) => {
      const inverted = projection.invert?.([x + center[0], z + center[1]]);
      setHudLonLat(inverted ? (inverted as [number, number]) : null);
    },
    [center]
  );

  return (
    <div
      ref={setContainerEl}
      className="relative w-full h-full overflow-hidden"
      onPointerLeave={() => {
        setHudLonLat(null);
        setAnchor(null);
      }}
    >
      <Canvas
        shadows
        camera={{ position: DEFAULT_CAM_POS, fov: 42, near: 1, far: 9000 }}
        dpr={[1, 1.75]}
        onPointerMissed={() => {
          setFocusedAbbr(null);
          controlsRef.current?.setLookAt(...DEFAULT_CAM_POS, ...DEFAULT_TARGET, true);
        }}
      >
        <color attach="background" args={[SCENE_BG]} />
        <fog attach="fog" args={[SCENE_BG, 1600, 3600]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[400, 600, 300]}
          intensity={1.3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-700}
          shadow-camera-right={700}
          shadow-camera-top={700}
          shadow-camera-bottom={-700}
        />
        <directionalLight position={[-500, 300, -400]} intensity={0.3} color="#60A5FA" />

        {/* Water: an animated velvety-wave ocean plane — real geography
         * (blue water, green land via LandPad) instead of an abstract
         * grid floor. No particles: the shader itself carries the motion,
         * so there's nothing that can drift off toward the horizon and
         * read as stray stars in the empty background. */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -5.3, 0]}
          onClick={() => {
            setFocusedAbbr(null);
            controlsRef.current?.setLookAt(...DEFAULT_CAM_POS, ...DEFAULT_TARGET, true);
          }}
          onPointerMove={(e) => handleWorldMove(e.point.x, e.point.z)}
        >
          <planeGeometry args={[6000, 6000]} />
          <WaterMaterial />
        </mesh>

        <Scene
          features={features}
          center={center}
          impactByAbbr={impactByAbbr}
          selectedAbbr={selectedAbbr}
          hoveredAbbr={hover?.abbr ?? null}
          focusedAbbr={focusedAbbr}
          onFocus={setFocusedAbbr}
          onSelect={onSelect}
          onHoverChange={setHover}
          onHoverMove={handleHoverMove}
          onWorldMove={handleWorldMove}
          onAnchorMove={setAnchor}
          controlsRef={controlsRef}
          highlightedAbbrs={highlightedAbbrs}
          highlightCommodity={highlightCommodity}
          supplyChainFlows={supplyChainFlows}
          onSupplyChainBuildingSelect={onSupplyChainBuildingSelect}
          wildfireStats={wildfireStats}
          onWildfireMarkerSelect={onWildfireMarkerSelect}
          activeWildfireAbbr={activeWildfireAbbr}
          financialRiskActive={financialRiskActive}
        />

        <CameraControls
          ref={controlsRef}
          makeDefault
          minDistance={90}
          maxDistance={2500}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.05}
          mouseButtons={{
            left: CameraControlsImpl.ACTION.ROTATE,
            middle: CameraControlsImpl.ACTION.DOLLY,
            right: CameraControlsImpl.ACTION.NONE,
            wheel: CameraControlsImpl.ACTION.DOLLY,
          }}
        />

        <EffectComposer>
          <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.7} mipmapBlur radius={0.55} />
        </EffectComposer>
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-4 rounded-md border border-border-strong bg-elevated/80 backdrop-blur px-3 py-1.5 font-mono text-[0.65rem] text-la-nina-deep tabular-nums">
        {hudLonLat
          ? `GEO ${Math.abs(hudLonLat[1]).toFixed(4)}°${hudLonLat[1] >= 0 ? "N" : "S"}  ${Math.abs(hudLonLat[0]).toFixed(4)}°${hudLonLat[0] >= 0 ? "E" : "W"}`
          : "GEO --.----°  --.----°"}
      </div>

      {hover &&
        containerEl &&
        anchor &&
        (() => {
          const tooltipLeft = Math.min(
            Math.max(hover.x - containerEl.getBoundingClientRect().left + 16, 8),
            containerEl.clientWidth - 260
          );
          const tooltipTop = Math.max(hover.y - containerEl.getBoundingClientRect().top + 16, 8);
          return (
            <svg className="pointer-events-none absolute inset-0 z-10 w-full h-full">
              <line
                x1={anchor.x}
                y1={anchor.y}
                x2={tooltipLeft}
                y2={tooltipTop + 10}
                stroke="var(--la-nina)"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <circle cx={anchor.x} cy={anchor.y} r="3.5" fill="var(--la-nina)" />
              <circle cx={anchor.x} cy={anchor.y} r="7" fill="none" stroke="var(--la-nina)" strokeWidth="1" opacity="0.5" />
            </svg>
          );
        })()}

      {hover && containerEl && (
        <div
          className="hud-card pointer-events-none absolute z-10 w-64 rounded-lg border border-border-strong bg-elevated px-4 py-3 shadow-xl"
          style={{
            left: Math.min(
              Math.max(hover.x - containerEl.getBoundingClientRect().left + 16, 8),
              containerEl.clientWidth - 260
            ),
            top: Math.max(hover.y - containerEl.getBoundingClientRect().top + 16, 8),
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text-primary text-sm">{hover.name}</span>
            {hover.impact && (
              <span
                className="text-xs font-bold font-mono tabular-nums px-1.5 py-0.5 rounded"
                style={{
                  color: riskColor(hover.impact.financialRiskScore),
                  background: "rgba(15,23,42,0.06)",
                }}
              >
                <CountUpNumber value={hover.impact.financialRiskScore} duration={400} />/100
              </span>
            )}
          </div>
          {hover.impact ? (
            <>
              <div className="text-[0.72rem] text-text-secondary mt-1.5 leading-relaxed">
                {hover.impact.climateNote}
              </div>
              <div className="text-[0.68rem] text-text-muted mt-2">
                Key exposure: {hover.impact.keyCommodities.join(", ") || "—"}
              </div>
            </>
          ) : (
            <div className="text-[0.72rem] text-text-muted mt-1.5">Impact data not yet available</div>
          )}
          <div className="text-[0.65rem] text-la-nina-deep mt-2">
            {focusedAbbr === hover.abbr ? "Click again for full detail" : "Click to zoom in"}
          </div>
        </div>
      )}

      <div className="hud-card pointer-events-none absolute top-4 right-4 w-44 rounded-lg border border-border-strong bg-elevated/85 backdrop-blur px-3.5 py-2.5">
        <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-2">
          Financial Risk Exposure
        </div>
        <div className="flex flex-col gap-1.5">
          {RISK_BANDS.map((band) => (
            <div key={band.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: riskColor(band.score) }}
                />
                <span className="text-[0.72rem] text-text-secondary truncate">{band.label}</span>
              </div>
              <span className="text-[0.66rem] font-mono text-text-muted shrink-0">{band.range}</span>
            </div>
          ))}
        </div>

        {wildfireStats && wildfireStats.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-border">
            <div className="text-[0.62rem] font-mono font-semibold uppercase tracking-widest text-text-muted mb-1.5">
              Wildfire Markers
            </div>
            <p className="text-[0.66rem] text-text-secondary leading-relaxed">
              Bar height &amp; color: real avg. annual acres burned (2005-2024, NIFC). Hover a bar for state, acreage,
              risk, and livestock exposure &middot; click for the full breakdown.
            </p>
          </div>
        )}
      </div>

      <div className="dark-on-bg pointer-events-none absolute bottom-3 right-4 font-mono text-[0.65rem] text-text-muted">
        {focusedAbbr
          ? "Click state again for full detail · Click background to zoom out"
          : "Click a state to zoom in · Drag to rotate · Scroll to zoom"}
      </div>
    </div>
  );
}
