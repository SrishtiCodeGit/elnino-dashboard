# backtest.py: does history back the El Nino risk model?

Run: `python3 data/backtest.py` (needs numpy, scipy, pandas). Writes `processed/backtest_results.json`, which the dashboard reads for the "Does history back the model?" panel in the Financial Risk > See Market Impact modal.

## Data
- **State climate:** NOAA NCEI nClimDiv statewide monthly temperature and precipitation, 1895-present (`raw/backtest/climdiv_*_state.txt`, downloaded from ncei.noaa.gov/monitoring-content/data/us/climdiv/monthly/current/). 50 states; DC is not in NOAA's set.
- **ENSO:** `processed/oni.json` (NOAA ONI). El Nino = ONI >= +0.5.
- **Markets:** `processed/financial_markets.json` and `processed/commodities.json`.

## Tests
1. **Direction** - For each state, winter (DJF) temperature (linearly detrended) and precipitation (% of mean) in El Nino winters vs all other winters, 1950-present (77 winters, 27 El Nino). Does the sign match the model's `ensoTempAnomaly` / `ensoPrecipAnomaly` label? p-values by permutation (10,000), corrected across all 100 state-variable tests with Benjamini-Hochberg FDR (q < 0.10).
2. **Strength** - Spearman correlation between the model's hand-assigned climate signal strength (35% of the score; recovered from the stored scores, which reproduce the documented formula) and the measured signal, sqrt(t_temp^2 + t_precip^2).
3. **Market transmission** - Monthly log returns of 7 series fixed in advance (Agriculture ETF, wheat, corn, crude oil, natural gas, Insurance ETF, S&P 500), El Nino vs other months. p-values by circular shifts of the El Nino indicator, which keeps ENSO's multi-month persistence (shuffling months would overstate significance). FDR-corrected across the 7.

## Results (as of the last run)
- **Temperature labels:** 23/23 directional labels match history; 5 states individually significant after FDR, all in the labelled direction.
- **Precipitation labels:** 25/32 match; 9 of the 10 individually significant states are in the labelled direction. Labels **not** supported by history: IA, KY, MO, ND, NE, SD, TN (ND, SD, IA, NE are the "milder, drier Northern Plains / Corn Belt" states; measured winter precipitation there shows no dry signal, and NE was wetter).
- **Strength ranking:** rho = 0.73 (n = 50). Florida, the Southeast and the Southwest show the strongest measured signal; the Northeast the weakest, as assigned. Largest disagreements: MI, KY, KS are stronger than assigned; OK, AR are weaker.
- **Markets:** none of the 7 series shows a statistically significant El Nino effect (smallest q = 0.64; crude oil was lowest at raw p = 0.09, El Nino months averaging -2.4 points/month worse). Only 5-12 independent El Nino episodes exist, so power is low: "not detected", not "no effect".

## Recalibration (`--apply`)
`python3 data/backtest.py --apply` replaces the purely hand-assigned climate strength with a 50/50 blend of that value and the measured one (percentile rank of the historical signal, mapped onto the same 25-90 scale), then recomputes `financialRiskScore` with the documented formula. The 50/50 split is shrinkage: 77 winters is noisy for a single state, so the hand-assigned value acts as a prior. DC (not in NOAA's data) keeps its assigned value. It is idempotent: the original values are stored as `climateStrengthAssigned` and `financialRiskScoreHandAssigned`.

Effect of the first application: mean absolute change 2.2 points; Arkansas 76 to 66, Oklahoma 85 to 77, Mississippi 77 to 70, Michigan 39 to 44; states at Severe (>= 75) went from 8 to 5 (Arkansas, Mississippi, South Dakota moved below 75). The test results above always compare the *hand-assigned* strength with the measured one.

## Limits
- Tests the climate and market premises, not state-level financial *outcomes*: no per-state loss data exists in this repo.
- The 30/20/15 exposure weights and the qualitative commodity/energy tiers cannot be tested with this data.
- Contemporaneous returns only; lagged responses and strong-only (ONI >= 1.0) events were not tested.
