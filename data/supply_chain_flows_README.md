# supply_chain_flows.json — real interstate commodity flow dataset

Companion data file: `supply_chain_flows.json` (60 records: top 10 highest-value
interstate flows per tracked commodity category).

## (a) Source

**Bureau of Transportation Statistics / Oak Ridge National Laboratory, Freight
Analysis Framework, Version 6 (FAF6)** — the U.S. government's own
state-to-state commodity flow dataset, base year 2022.
- Query tool: https://faf.ornl.gov/faf6/dtt_total.aspx
- Landing page: https://www.bts.gov/faf

FAF6 reports estimated freight movement between "FAF zones" — small states are
a single zone; populous states are split into their major metro areas plus a
"Rest of X" zone (e.g. California = Los Angeles, Sacramento, San Diego, San
Francisco, Fresno, Rest of CA). `data/raw/supply_chain_flows.csv` is FAF6's
own zone-level export (`dms_orig`, `dms_dest`, `sctg2` commodity code,
`value` in million 2022 dollars), queried with:
- Flow Type: **Domestic Flows**
- Year: **2022**
- Measure: **value** (dollars — this project is framed around financial risk,
  so dollar value fits better than physical tonnage)
- Origin / Destination: **every** FAF zone, individually selected (not the
  "combined" aggregate mode)
- Commodity: the six SCTG2 codes listed below

`data/build.py`'s `build_supply_chain_flows()` maps every zone back to its
2-letter state (`FAF_ZONE_TO_STATE`, a plain lookup table taken directly from
the picker's own zone list — not an estimate), drops intra-state flows (a
state shipping to itself isn't a supply chain risk signal), sums to
`(origin, destination, commodity)`, and keeps the **top 10 highest-value
flows per commodity category** — not a single global top-N. A global ranking
would have been entirely natural gas and crude petroleum (their dollar
values run 5-10x higher than agricultural commodities) and would have
silently dropped cereal grains and meat/seafood from the map completely.
Keeping every commodity represented was judged more honest and more useful
than a purely value-ranked list, at the cost of some very-high-value
lower-priority-commodity flows being excluded.

## (b) Commodity mapping

| SCTG2 code | FAF6 category | Mapped to this project's tracked commodities |
|---|---|---|
| 02 | Cereal grains | Wheat, Corn, Sorghum |
| 03 | Other ag prods. | Cotton and other raw agricultural goods |
| 05 | Meat/seafood | Cattle, Seafood |
| 14 | Metallic ores | Gold (imperfect proxy — see limitations) |
| 16 | Crude petroleum | Crude Oil |
| 19 | Natural gas and other fossil products | Natural Gas |

## (c) Known limitations

- **Coffee and Cocoa are excluded.** Both have essentially no continental
  U.S. domestic production (matching the same caveat already documented in
  `state_impact_README.md`), so a *domestic* origin-destination flow
  wouldn't represent a real production corridor for either. Representing
  them would require *import* flow data (port of entry → distribution),
  which is a materially different signal from the rest of this dataset and
  was left out rather than mixed in without a clear label.
- **"14 - Metallic ores" is an imperfect proxy for Gold.** FAF6's SCTG
  categories don't isolate gold specifically — this category covers all
  metallic ore mining and shipment. Flows tagged with this commodity should
  be read as "metals mining exposure," not gold-specific.
- **FAF6 zones, not literal state boundaries, are the native unit.** The
  zone→state mapping is exact and complete (BTS's own picker data), but a
  state split into multiple metro zones (e.g., Texas has 9 zones) means the
  "origin state" is really "the sum of that state's zones" — real, but a
  coarser resolution than a true point-to-point supply chain.
- **Only the top 10 flows per commodity are kept**, out of ~23,000 real
  interstate (origin state ≠ destination state) rows in the full query.
  This is a deliberate visual/performance choice for the map (an unfiltered
  matrix would be an unreadable "spaghetti" of arcs) — it is not the full
  picture of U.S. interstate trade for these commodities, only the largest
  corridors.
- **"At risk" tagging is not part of this file.** This dataset is purely the
  real flow values; risk severity is derived at render time from the
  origin state's already-computed `financialRiskScore` in
  `state_impact.json` — no new risk model was introduced for this feature.
- Reflects 2022 (FAF6's current base year) commodity flows; freight patterns
  shift year to year and this should be refreshed if FAF publishes a newer
  base year.

## Reproducing / updating this file

1. Query https://faf.ornl.gov/faf6/dtt_total.aspx with the exact settings in
   section (a) above — critically, use **"Select All/Specific"** for origin,
   destination, and commodity (not the plain tab or "Combined" buttons,
   which pre-aggregate everything into a single total and lose the
   breakdown entirely).
2. Use the page's "Interactive Tabulation and Chart" → download to get the
   zone-level CSV (columns: `dms_orig`, `dms_dest`, `sctg2`, value).
3. Save it as `data/raw/supply_chain_flows.csv`, then run `python3
   data/build.py` — `build_supply_chain_flows()` does the rest.
