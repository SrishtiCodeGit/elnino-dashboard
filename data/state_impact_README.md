# state_impact.json — El Nino / Financial Markets state exposure dataset

Companion data file: `state_impact.json` (array of 51 objects: 50 states + DC).
Built for: El Nino & Financial Markets research project (advisor: Prof. Haralambos Kostakopoulos).

## (a) Sources used

**Climate pattern (`ensoTempAnomaly`, `ensoPrecipAnomaly`, `climateNote`)**
- NOAA Climate.gov, "How El Nino and La Nina affect the winter jet stream and U.S. climate" — https://www.climate.gov/news-features/featured-images/how-el-ni%C3%B1o-and-la-ni%C3%B1a-affect-winter-jet-stream-and-us-climate
- NOAA Climate.gov, "El Nino and U.S. winter weather" — https://www.climate.gov/news-features/featured-images/el-ni%C3%B1o-and-us-winter-weather
- NOAA Climate.gov ENSO portal — https://www.climate.gov/enso
- Hawaii-specific drought/coffee impact: Big Island Now and Hawaii Tribune-Herald reporting on El Nino-linked drought and Kona coffee yield loss.

NOAA's own composites describe El Nino winters as: **cooler and wetter than average across the southern tier of the U.S.** (Gulf Coast, Deep South, Southern Plains, Southwest/California), and **milder (warmer) and typically drier than average across the Pacific Northwest and northern tier** (Northern Rockies, Northern Plains, Upper Midwest). The Ohio Valley/Mid-Atlantic/Northeast sit in a transition zone where the published NOAA composites explicitly note the signal is weaker and less consistent ("probability, not certainty"). This project extrapolated each state to one of these NOAA-documented regional buckets; NOAA does not publish a state-by-state table, so the state assignment (which NOAA region a given state's climate belongs to) is this project's own regionalization, not an official NOAA product.

**Agricultural/commodity production by state**
- USDA NASS, 2024 Small Grains Summary and state Annual Statistical Bulletins (wheat: ND, KS top producers).
- USDA NASS Crop Production reports 2024 / soystats.com (corn: IA, IL top; soybeans: broad Midwest/Delta belt).
- USDA NASS Cotton Ginnings and Cattle Inventory reports 2024, USDA ERS cash receipts (cotton: TX, GA, AR top; cattle: TX largest).
- Hawaii Dept. of Agriculture / press reporting for Kona coffee (the only significant U.S.-grown coffee).

**Energy production by state**
- EIA, "Where our oil comes from" — state crude oil production rankings (TX ~42% of U.S. output, NM #2, ND #3-4, OK/WY/AK notable) — https://www.eia.gov/energyexplained/oil-and-petroleum-products/where-our-oil-comes-from.php
- EIA, "Five states drove record U.S. natural gas production in 2023" — TX, PA, LA, WV, NM as top 5 (73% of U.S. marketed gas) — https://www.eia.gov/todayinenergy/detail.php?id=63964

**Agriculture as % of state GDP (`agGdpShare`)**
- Commodity.com, "US States Most Dependent on Agriculture," which computed this ranking from **US Bureau of Economic Analysis (BEA)** GDP-by-state data — https://commodity.com/blog/state-economies-agriculture/
- Only the ~15 states covered by that ranking (SD, NE, ND, IA, ID, MT, KS, WY, NM, MS, MN, OK, WI, VT, KY) received a real numeric value. Every other state is `null` — **no fabricated numbers were entered.** The article did not state its exact reference year, which is itself noted as a limitation below.

## (b) How `financialRiskScore` (0–100) was computed

The score is a **transparent weighted composite** of four sub-scores, each placed on a common 0–100 scale, then combined with fixed weights. The exact build script (`build_state_impact.py`, used to generate this JSON) encodes this formula directly — it is fully reproducible from the categorical/source fields already in each record.

```
financialRiskScore = round(
    0.35 * climateSignalStrength +
    0.30 * commodityExposureScore +
    0.20 * energyExposureScore +
    0.15 * agGdpShareScore
)
```

1. **climateSignalStrength (35% weight)** — how strong/reliable NOAA's composite ENSO analysis shows a *directional* temperature/precipitation anomaly for that state's region (this measures signal reliability, not severity of the anomaly itself):
   - 90: Deep South / Gulf Coast and Southern Plains (TX, OK) — NOAA's clearest, most cited El Nino signal (cool + wet)
   - 85: Pacific Northwest — classic warm + dry signal
   - 80: Hawaii — documented drought linkage
   - 75: Southwest (wetter) and Northern Rockies/Plains (warmer/drier)
   - 70: California
   - 65: Upper Midwest
   - 60: Alaska
   - 55: Transition states (KS, CO, UT, NV)
   - 45: Ohio Valley
   - 40: Michigan
   - 35: Mid-Atlantic
   - 25: Northeast (weakest/most inconsistent signal per NOAA's own caveats)

2. **commodityExposureScore (30% weight)** — maps the qualitative `commodityExposure` field: high=100, medium=60, low=25.

3. **energyExposureScore (20% weight)** — maps the qualitative `energyExposure` field: high=100, medium=60, low=25, none=0.

4. **agGdpShareScore (15% weight)** — if a real `agGdpShare` figure was found: `min(100, agGdpShare / 6 * 100)` (6% was chosen as a soft ceiling since South Dakota's ~5.8% is the highest value found in any state). If `agGdpShare` is `null` (no sourced figure), a flat conservative default of 15 is used so that missing data does not artificially zero out or inflate a state's score.

Weights (0.35 / 0.30 / 0.20 / 0.15) reflect this project's judgment that (i) the directional climate signal is the causal starting point of the whole ENSO -> markets thesis, (ii) commodity exposure is the primary transmission channel the underlying research already validated (wheat, corn, soybeans/cotton, cattle), (iii) energy exposure is a secondary but still major transmission channel (crude oil, natural gas futures), and (iv) overall ag-GDP share is a smaller magnitude check on how much a state's broader economy is riding on that exposure. These weights are a modeling choice, not an empirical estimate — see limitations.

## (c) Known limitations

- **This is a research approximation, not an official government risk index.** No federal agency publishes a per-state "El Nino financial risk score." `financialRiskScore` is this project's own synthesized composite, built transparently from real sourced inputs using the formula above — treat it as a reasoned starting point for the dashboard, not a validated risk model.
- **State-to-NOAA-region assignment is a project judgment call.** NOAA's published composites describe broad regions (Gulf Coast, Pacific Northwest, Southwest, Northern Plains, etc.), not exact state boundaries. Assigning each state to one bucket (and to one direction of anomaly) necessarily simplifies real intra-state variation (e.g., northern vs. southern California, western vs. eastern Washington).
- **`ensoTempAnomaly`/`ensoPrecipAnomaly` of "mixed" or "near_normal"** reflects NOAA's own statements that outside the core signal regions (Northeast, Mid-Atlantic, parts of the Rockies/Great Basin), El Nino's effect is weak, inconsistent, or probabilistic rather than deterministic — even the strong-signal states only see a *shifted probability* of anomalies in a given direction, not a guaranteed outcome every event.
- **`agGdpShare` coverage is partial.** Only ~15 states had a findable, citable BEA-derived percentage (via the Commodity.com compilation); all others are `null` by design rather than estimated. The exact BEA reference year for that compiled ranking was not stated in the source and should be re-verified against bea.gov directly (Gross Domestic Product by State, "Farms" industry line) before being used in any published/academic output.
- **`keyCommodities` and exposure levels (`commodityExposure`, `energyExposure`) are qualitative syntheses**, not derived from a single official per-state index — they combine real USDA NASS/EIA production rankings with this project's judgment about how much that production matters to the state's overall economy and to the futures markets the parent research already studies (wheat, corn, soybeans/cotton, cattle, crude oil, natural gas). Two informed analysts could reasonably assign a different tier to a borderline state (e.g., Ohio's energy exposure, Virginia's commodity exposure).
- **Coffee and cocoa**, both named in the parent research's commodity list, have essentially no continental U.S. production; Hawaii (Kona coffee) is the only state where this is a real, sourced exposure channel. Cocoa has no U.S. state-level production exposure and is not represented anywhere in this dataset.
- **No insurance-claims or KBE/KIE-specific state data** (e.g., NAIC catastrophe loss data by state) was incorporated — Florida and Gulf Coast states' higher scores reflect climate/commodity exposure only, and the README flags insurance risk qualitatively in `climateNote` where relevant (e.g., Florida) rather than quantitatively.
- Data reflects production rankings and patterns as reported in 2023-2025 sources; commodity production rankings shift year to year and should be refreshed periodically for a live dashboard.

## Reproducing / updating this file

The generating script lives at the path used during research (`build_state_impact.py`, not checked into this repo). Regenerating requires: (1) updating the `ROWS` table with any new sourced figures, (2) the `score()` function applies the fixed formula above automatically. This keeps the score reproducible and auditable rather than manually assigned per state.
