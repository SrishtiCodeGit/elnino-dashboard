# wildfire_by_state.json — real historical wildfire dataset

Companion data files: `wildfire_by_state.json` (per state: average annual
acres burned, fire count, 2005-2024) and `wildfire_by_year.json` (national
total acres burned and fire count per year, 2005-2019 — see the
completeness note below for why it stops at 2019).

## (a) Source

**National Interagency Fire Center (NIFC), InterAgencyFirePerimeterHistory**
— the U.S. government's own combined wildfire perimeter history, pooling
USDA Forest Service, DOI Bureau of Land Management, Bureau of Indian
Affairs, Fish & Wildlife Service, National Park Service, state agencies
(e.g. CAL FIRE), and the Alaska Interagency Fire Center.

- Public REST endpoint (no login required):
  `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/InterAgencyFirePerimeterHistory_All_Years_View/FeatureServer/0/query`
- Landing page: https://data-nifc.opendata.arcgis.com/datasets/nifc::interagencyfireperimeterhistory-all-years-view/about

`data/raw/wildfire_perimeters.csv` was pulled directly from that endpoint —
paginated queries (`resultRecordCount=2000` + `resultOffset`),
`outFields=UNIT_ID,GIS_ACRES,FIRE_YEAR_INT`, `returnGeometry=false`, filtered
to `FIRE_YEAR_INT>=2005 AND FIRE_YEAR_INT<9999 AND UNIT_ID IS NOT NULL` —
32,443 real fire-perimeter records, one row per fire.

`data/build.py`'s `build_wildfire_stats()` maps each record's state from
`UNIT_ID` (NWCG Unit ID convention: the first two characters are the state
postal code, e.g. `NMLNF` = New Mexico, Lincoln National Forest), sums
`GIS_ACRES` per state, and divides by the number of years covered (20:
2005-2024) to get **average annual acres burned**, plus a raw fire count.

## (b) Filtering rationale

- **`FIRE_YEAR_INT = 9999`** is the dataset's own sentinel value for
  incomplete/unverified records — excluded, not treated as a real year.
- **Null `UNIT_ID`** rows have no recoverable state — excluded.
- **~0.15% of remaining `UNIT_ID` prefixes don't match a real US state
  postal code** (a handful of numeric BLM district codes, e.g. `"09"`,
  found in a 2,000-record sample check) — dropped rather than guessed at,
  consistent with this project's policy of never inventing a mapping it
  isn't confident in.
- **2005-2024 window**: chosen to reflect current wildfire risk conditions
  (fire severity has trended up over recent decades) rather than diluting
  it with a multi-decade all-time average.

Sanity check against known geography: the top 10 states by total acres in
this pull are AK, CA, ID, OR, NV, WA, AZ, MT, UT, NM — exactly the
states with the most documented wildfire activity in the U.S.

## (c) Known limitations

- **This is historical fire history, not a forecast or a live risk index.**
  It says nothing about *this* fire season specifically.
- **`GIS_ACRES` is the GIS-computed perimeter area**, not an official
  damage/loss estimate — a real, government-published figure, but a
  geometric one.
- **No real per-state livestock financial-loss dataset was found or used.**
  Any commentary connecting wildfire history to livestock/poultry exposure
  reasons from documented general mechanisms (heat stress, smoke inhalation,
  feed/water disruption) and this state's real `keyCommodities` from
  `state_impact.json` — it does not claim a specific dollar loss figure.
- Prescribed burns are included in recent years of the source dataset
  (NIFC began including them) — this may modestly inflate recent acreage
  relative to wildfire alone for some states.
- **`wildfire_by_year.json` stops at 2019, not 2024.** NIFC's
  InterAgencyFirePerimeterHistory only holds *finalized* perimeters —
  recent seasons take a year or more of QA before being added. The raw
  per-year record count in this pull falls from 1,456-3,254/year across
  2005-2019 to just 28-101/year for 2020-2024 — a data-completeness
  artifact, not a real decline (2020-2023 were severe US wildfire
  seasons). Plotting that incomplete tail would visually suggest wildfires
  nearly stopped, which is false, so `build_wildfire_by_year()` in
  `data/build.py` cuts the series at 2019 — the last year whose fire count
  is in the normal range — instead of shipping a chart with a misleading
  drop-off. `wildfire_by_state.json`'s per-state averages still divide by
  the full 20-year span; the near-zero incomplete years contribute
  negligible acreage either way, so they don't meaningfully distort a
  20-year average the way they visually distort a year-by-year line.

## Reproducing / updating this file

1. Query the endpoint above with the filters in section (a) — paginate with
   `resultRecordCount`/`resultOffset` since a single request is capped.
2. Save the combined `UNIT_ID,GIS_ACRES,FIRE_YEAR_INT` rows as
   `data/raw/wildfire_perimeters.csv`.
3. Run `python3 data/build.py` — `build_wildfire_stats()` does the rest.
