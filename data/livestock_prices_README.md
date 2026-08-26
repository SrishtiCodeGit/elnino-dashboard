# livestock_prices.json — real Beef & Chicken price history

Companion data file: `livestock_prices.json` (monthly Beef and Chicken
prices in nominal USD/kg, January 2000 - December 2025).

## (a) Source

**World Bank Commodity Markets ("Pink Sheet")** — the World Bank's own
monthly commodity price dataset, published by the Prospects Group and used
throughout its own Commodity Markets Outlook reports.

- Download: https://www.worldbank.org/en/research/commodity-markets
  ("Monthly Prices" sheet of the CMO Historical Data workbook)
- Columns used: **Beef** (col 41) and **Chicken** (col 42) of the "Monthly
  Prices" sheet, both in nominal $/kg. These are the same two livestock
  series the World Bank itself tracks — there is no separate "Cattle" or
  "Poultry" column; Beef and Chicken are the real-world commodity forms
  those animals are actually traded and priced as.

`data/raw/livestock_prices.csv` holds every `YYYY-MM` row from the
workbook from 2000 onward, with the two price columns, dated to the 1st of
each month.

## (b) Why this instead of a Cattle/Poultry futures series

This app already has no Cattle or Poultry series in `commodities.json`
(only Wheat, Corn, Coffee, Cocoa, Crude Oil, Gold, and Nat Gas futures).
FRED's own Slaughter Cattle / Slaughter Poultry PPI series and Yahoo
Finance's futures history were both attempted first and were unreachable
from this environment (bot-protection resets / rate limits) — the World
Bank Pink Sheet was reachable and is itself a standard, citable primary
source for this exact purpose, not a fallback of lower quality.

## (c) Known limitations

- **Monthly, not daily** — coarser than the existing daily futures series
  in `commodities.json`. Charted on the same time axis, this just means
  fewer points per year, not synthetic/interpolated ones; every point is a
  real reported monthly price.
- **Nominal USD, global reference price** — not a US-specific producer
  price, and not inflation-adjusted. A real, published, and widely-cited
  figure, but not the same thing as a US livestock producer's realized
  price.
- **No causal claim.** This series is shown alongside wildfire acreage
  strictly as an independent real data series for temporal comparison —
  correlation shown, not causation claimed. See the in-app disclaimer next
  to any chart that pairs the two.

## Reproducing / updating this file

1. Download the current CMO Historical Data Monthly workbook from the URL
   above.
2. Read the "Monthly Prices" sheet; columns 41 (Beef) and 42 (Chicken),
   header row 5, data starting row 7, `YYYY-MM01`-style period codes in
   column 0.
3. Write `date,Beef_PriceUsdKg,Chicken_PriceUsdKg` rows (date as
   `YYYY-MM-01`) to `data/raw/livestock_prices.csv`.
4. Run `python3 data/build.py` — `build_generic("livestock_prices", ...)`
   does the rest.
