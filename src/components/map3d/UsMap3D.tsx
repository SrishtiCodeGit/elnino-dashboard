"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { feature } from "topojson-client";
import { geoPath, geoAlbersUsa } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { STATE_BY_FIPS } from "@/lib/states";
import { riskColor } from "@/lib/theme";
import type { StateImpact } from "@/lib/dataUtils";
import { StateMesh } from "./StateMesh";
import { LandPad } from "./LandPad";

interface Props {
  topology: Topology;
  impactByAbbr: Record<string, StateImpact>;
  selectedAbbr?: string | null;
  onSelect: (abbr: string) => void;
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

const DEFAULT_CAM_POS: [number, number, number] = [0, 650, 840];
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
}) {
  const { camera, size } = useThree();
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

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

  return (
    <group position={[-center[0], 0, -center[1]]}>
      {features.map((f) => {
        const fips = String(f.id);
        const ref = STATE_BY_FIPS[fips];
        const impact = ref ? impactByAbbr[ref.abbr] : undefined;
        const color = impact ? riskColor(impact.financialRiskScore) : NO_DATA_COLOR;
        const height = heightForScore(impact?.financialRiskScore);
        if (!ref) return null;

        const m = meta.get(ref.abbr);
        const isFocused = focusedAbbr === ref.abbr;
        const dimmed = focusedAbbr != null && !isFocused;

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
              dimmed={dimmed}
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
          </group>
        );
      })}
    </group>
  );
}

export function UsMap3D({ topology, impactByAbbr, selectedAbbr, onSelect }: Props) {
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
        <fog attach="fog" args={[SCENE_BG, 1300, 3200]} />
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
        />

        <CameraControls
          ref={controlsRef}
          makeDefault
          minDistance={90}
          maxDistance={2200}
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

      <div className="pointer-events-none absolute inset-4 z-10">
        <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-la-nina/50" />
        <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-la-nina/50" />
        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-la-nina/50" />
        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-la-nina/50" />
      </div>

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
                {hover.impact.financialRiskScore}/100
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
      </div>

      <div className="dark-on-bg pointer-events-none absolute bottom-3 right-4 font-mono text-[0.65rem] text-text-muted">
        {focusedAbbr
          ? "Click state again for full detail · Click background to zoom out"
          : "Click a state to zoom in · Drag to rotate · Scroll to zoom"}
      </div>
    </div>
  );
}
