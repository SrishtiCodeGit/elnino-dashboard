"""Historical backtest of the El Nino financial-risk model.

Run:  python3 data/backtest.py            (test only; writes backtest_results.json)
      python3 data/backtest.py --apply    (also recalibrates state_impact.json)
Writes: data/processed/backtest_results.json

Three tests, each against real historical data already in this repo or in
data/raw/backtest/ (NOAA nClimDiv statewide monthly climate, 1895-present):

  1. Direction test   - do the model's per-state El Nino temperature and
                        precipitation labels match what actually happened in
                        El Nino winters (DJF), 1950-present?
  2. Strength test    - does the model's hand-assigned "climate signal
                        strength" (35% of the score) rank states the way the
                        historical signal-to-noise does?
  3. Transmission test- do the market series behind the model's commodity and
                        energy channels behave differently in El Nino months?
                        Series were fixed in advance (no cherry-picking).

Statistics: Welch t-test + permutation test for state anomalies; circular-shift
permutation for market series (preserves the multi-month persistence of ENSO
regimes, which naive shuffling would destroy); Benjamini-Hochberg FDR across
each family of tests; Spearman rank correlation for the strength test.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).parent
RAW = ROOT / "raw" / "backtest"
PROCESSED = ROOT / "processed"

EL_NINO_THRESHOLD = 0.5  # NOAA: ONI >= +0.5 is El Nino
N_PERM = 10_000
FDR_Q = 0.10
SEED = 42

# NOAA nClimDiv state codes 001-050 (alphabetical by name, then HI, AK).
CODE_TO_ABBR = dict(
    zip(
        range(1, 51),
        "AL AZ AR CA CO CT DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY HI AK".split(),
    )
)

CLIMATE_BUCKETS = [90, 85, 80, 75, 70, 65, 60, 55, 45, 40, 35, 25]
COMMODITY_SCORE = {"high": 100, "medium": 60, "low": 25}
ENERGY_SCORE = {"high": 100, "medium": 60, "low": 25, "none": 0}


def bh_fdr(pvals):
    """Benjamini-Hochberg adjusted p-values (q-values)."""
    p = np.asarray(pvals, dtype=float)
    n = len(p)
    order = np.argsort(p)
    q = np.empty(n)
    prev = 1.0
    for rank in range(n, 0, -1):
        i = order[rank - 1]
        prev = min(prev, p[i] * n / rank)
        q[i] = prev
    return q


def load_climdiv(path, element):
    """-> {abbr: DataFrame(year x 12 months)} for statewide rows of one element."""
    out = {}
    for line in path.read_text().splitlines():
        parts = line.split()
        if len(parts) != 13:
            continue
        key = parts[0]
        state_code, division, elem, year = int(key[:3]), key[3], key[4:6], int(key[6:10])
        if division != "0" or elem != element or state_code not in CODE_TO_ABBR:
            continue
        vals = [float(v) for v in parts[1:]]
        vals = [np.nan if v <= -9.9 else v for v in vals]
        out.setdefault(CODE_TO_ABBR[state_code], {})[year] = vals
    return {ab: pd.DataFrame.from_dict(d, orient="index", columns=range(1, 13)).sort_index() for ab, d in out.items()}


def winter_series(df, kind):
    """DJF value for each winter year Y (Dec of Y-1 + Jan, Feb of Y)."""
    rows = {}
    for y in df.index:
        if y - 1 not in df.index:
            continue
        vals = [df.loc[y - 1, 12], df.loc[y, 1], df.loc[y, 2]]
        if np.isnan(vals).any():
            continue
        rows[y] = float(np.mean(vals)) if kind == "temp" else float(np.sum(vals))
    return pd.Series(rows)


def perm_pvalue(x, is_nino, perms):
    """Two-sided permutation p-value for difference in means (El Nino - other)."""
    obs = x[is_nino].mean() - x[~is_nino].mean()
    n1 = is_nino.sum()
    total = x.sum()
    # For each permutation of indices, first n1 entries are the pseudo El Nino group.
    grp = x[perms[:, :n1]].sum(axis=1)
    diffs = grp / n1 - (total - grp) / (len(x) - n1)
    return obs, (np.sum(np.abs(diffs) >= abs(obs) - 1e-12) + 1) / (len(diffs) + 1)


def infer_climate_strength(s):
    others = 0.30 * COMMODITY_SCORE[s["commodityExposure"]] + 0.20 * ENERGY_SCORE[s["energyExposure"]]
    ag = 0.15 * (min(100, s["agGdpShare"] / 6 * 100) if s["agGdpShare"] is not None else 15)
    raw = (s["financialRiskScore"] - others - ag) / 0.35
    return min(CLIMATE_BUCKETS, key=lambda b: abs(b - raw))


def assigned_strength(s):
    """The hand-assigned climate-signal strength. Stored on first recalibration
    so reruns stay idempotent (the stored score no longer reveals it)."""
    return s.get("climateStrengthAssigned") or infer_climate_strength(s)


def recalibrate(state_list, rows):
    """Blend the hand-assigned climate strength 50/50 with the strength
    measured from history, then recompute the documented score formula
    (0.35 climate + 0.30 commodity + 0.20 energy + 0.15 ag share).

    Measured strength = percentile rank of the historical signal (sqrt of
    t_temp^2 + t_precip^2) mapped onto the same 25-90 scale the hand-assigned
    buckets use. The 50/50 blend is shrinkage: 77 winters is noisy for any one
    state, so the hand-assigned value acts as a prior. States NOAA doesn't
    cover (DC) keep their assigned value."""
    signals = np.array([r["historicalSignal"] for r in rows])
    by_abbr = {r["abbr"]: r for r in rows}
    for s in state_list:
        assigned = assigned_strength(s)
        row = by_abbr.get(s["abbr"])
        measured = 25 + 65 * stats.percentileofscore(signals, row["historicalSignal"], kind="mean") / 100 if row else None
        blended = assigned if measured is None else 0.5 * assigned + 0.5 * measured
        ag = min(100, s["agGdpShare"] / 6 * 100) if s["agGdpShare"] is not None else 15
        score = 0.35 * blended + 0.30 * COMMODITY_SCORE[s["commodityExposure"]] + 0.20 * ENERGY_SCORE[s["energyExposure"]] + 0.15 * ag
        s.setdefault("financialRiskScoreHandAssigned", s["financialRiskScore"])
        s["climateStrengthAssigned"] = assigned
        s["climateStrengthMeasured"] = None if measured is None else round(float(measured), 1)
        s["climateStrength"] = round(float(blended), 1)
        s["financialRiskScore"] = int(round(score))


def main():
    oni = pd.DataFrame(json.loads((PROCESSED / "oni.json").read_text()))
    oni["ym"] = oni["date"].str[:7]
    states = {s["abbr"]: s for s in json.loads((ROOT / "state_impact.json").read_text())}

    # ---------- Tests 1 & 2: state climate ----------
    djf = oni[oni["season"] == "DJF"].copy()
    djf["winter"] = djf["date"].str[:4].astype(int)
    djf = djf.set_index("winter")["ONI"]

    tmp = load_climdiv(RAW / "climdiv_tmp_state.txt", "02")
    pcp = load_climdiv(RAW / "climdiv_pcp_state.txt", "01")

    rng = np.random.default_rng(SEED)
    perm_cache = {}
    rows = []
    for abbr in sorted(tmp):
        if abbr not in states:
            continue
        t = winter_series(tmp[abbr], "temp")
        p = winter_series(pcp[abbr], "pcp")
        years = sorted(set(t.index) & set(p.index) & set(djf.index))
        years = [y for y in years if y >= 1950]
        yr = np.array(years, dtype=float)
        # Temperature: remove the linear warming trend so the test isn't
        # confounded by El Nino winters being unevenly spread over time.
        tv = t.loc[years].to_numpy()
        slope, intercept = np.polyfit(yr, tv, 1)
        t_anom = tv - (slope * yr + intercept)
        # Precipitation: percent departure from the period mean.
        pv = p.loc[years].to_numpy()
        p_anom = (pv - pv.mean()) / pv.mean() * 100

        is_nino = djf.loc[years].to_numpy() >= EL_NINO_THRESHOLD
        n = len(years)
        if n not in perm_cache:
            perm_cache[n] = np.array([rng.permutation(n) for _ in range(N_PERM)])
        perms = perm_cache[n]

        res = {"abbr": abbr, "winters": n, "elNinoWinters": int(is_nino.sum())}
        for name, series in (("temp", t_anom), ("pcp", p_anom)):
            diff, pval = perm_pvalue(series, is_nino, perms)
            welch = stats.ttest_ind(series[is_nino], series[~is_nino], equal_var=False)
            pooled = np.sqrt((series[is_nino].var(ddof=1) + series[~is_nino].var(ddof=1)) / 2)
            res[name] = {
                "diff": round(float(diff), 3),
                "cohensD": round(float(diff / pooled), 3),
                "t": round(float(welch.statistic), 3),
                "pPerm": round(float(pval), 4),
            }
        rows.append(res)

    # FDR across the family of 100 state-variable tests.
    allp = [r[v]["pPerm"] for r in rows for v in ("temp", "pcp")]
    qs = bh_fdr(allp)
    for i, r in enumerate(rows):
        r["temp"]["qFdr"] = round(float(qs[2 * i]), 4)
        r["pcp"]["qFdr"] = round(float(qs[2 * i + 1]), 4)

    # Test 1: direction of the model's labels.
    def sign_ok(label, diff):
        return diff > 0 if label == "above_normal" else diff < 0

    direction = {}
    for var, field in (("temp", "ensoTempAnomaly"), ("pcp", "ensoPrecipAnomaly")):
        directional = [(r, states[r["abbr"]][field]) for r in rows if states[r["abbr"]][field] in ("above_normal", "below_normal")]
        hits = [sign_ok(lab, r[var]["diff"]) for r, lab in directional]
        sig = [(r, lab) for r, lab in directional if r[var]["qFdr"] < FDR_Q]
        sig_hits = [sign_ok(lab, r[var]["diff"]) for r, lab in sig]
        neutral = [r for r in rows if states[r["abbr"]][field] in ("near_normal", "mixed")]
        missed = [r["abbr"] for r in neutral if r[var]["qFdr"] < FDR_Q]
        direction[var] = {
            "directionalLabels": len(directional),
            "signMatches": int(sum(hits)),
            "signMatchRate": round(sum(hits) / len(hits), 3),
            "binomialP": round(float(stats.binomtest(int(sum(hits)), len(hits), 0.5).pvalue), 6),
            "significantAtFdr": len(sig),
            "significantAndCorrectDirection": int(sum(sig_hits)),
            "significantButLabelledNeutral": missed,
            "neutralLabelled": len(neutral),
        }

    # Test 2: strength ranking.
    for r in rows:
        r["modelClimateStrength"] = assigned_strength(states[r["abbr"]])
        r["historicalSignal"] = round(float(np.hypot(r["temp"]["t"], r["pcp"]["t"])), 3)
    rho, rho_p = stats.spearmanr([r["modelClimateStrength"] for r in rows], [r["historicalSignal"] for r in rows])
    strength = {
        "n": len(rows),
        "spearmanRho": round(float(rho), 3),
        "spearmanP": round(float(rho_p), 4),
    }

    # ---------- Test 3: market transmission ----------
    oni_map = dict(zip(oni["ym"], oni["ONI"]))
    fin = pd.DataFrame(json.loads((PROCESSED / "financial_markets.json").read_text()))
    com = pd.DataFrame(json.loads((PROCESSED / "commodities.json").read_text()))
    fin["date"] = pd.to_datetime(fin["date"])
    com["date"] = pd.to_datetime(com["date"])

    series_plan = [
        ("Agriculture ETF", "commodity channel", fin, "Agriculture_ETF"),
        ("Wheat futures", "commodity channel", com, "Wheat_Futures"),
        ("Corn futures", "commodity channel", com, "Corn_Futures"),
        ("Crude oil futures", "energy channel", com, "CrudeOil_Futures"),
        ("Natural gas futures", "energy channel", com, "NatGas_Futures"),
        ("Insurance ETF", "insurance channel", fin, "Insurance_ETF"),
        ("S&P 500", "broad market", fin, "SP500"),
    ]
    market = []
    for label, channel, df, col in series_plan:
        px = df.set_index("date")[col].dropna()
        px = px[px > 0]  # crude futures printed negative in Apr 2020
        monthly = px.resample("ME").last().dropna()
        ret = np.log(monthly).diff().dropna() * 100
        idx = [d.strftime("%Y-%m") for d in ret.index]
        keep = [i for i, ym in enumerate(idx) if ym in oni_map]
        r = ret.to_numpy()[keep]
        flag = np.array([oni_map[idx[i]] >= EL_NINO_THRESHOLD for i in keep])
        obs = r[flag].mean() - r[~flag].mean()
        # Circular shifts of the El Nino indicator keep its block structure.
        diffs = []
        for k in range(1, len(flag)):
            f = np.roll(flag, k)
            diffs.append(r[f].mean() - r[~f].mean())
        p_perm = (np.sum(np.abs(diffs) >= abs(obs) - 1e-12) + 1) / (len(diffs) + 1)
        episodes = int(np.sum(flag & ~np.roll(flag, 1)))
        market.append(
            {
                "series": label,
                "channel": channel,
                "months": int(len(r)),
                "elNinoMonths": int(flag.sum()),
                "elNinoEpisodes": episodes,
                "firstMonth": idx[keep[0]],
                "meanMonthlyReturnElNinoPct": round(float(r[flag].mean()), 3),
                "meanMonthlyReturnOtherPct": round(float(r[~flag].mean()), 3),
                "diffPct": round(float(obs), 3),
                "pCircularShift": round(float(p_perm), 4),
            }
        )
    mq = bh_fdr([m["pCircularShift"] for m in market])
    for m, q in zip(market, mq):
        m["qFdr"] = round(float(q), 4)

    out = {
        "meta": {
            "elNinoThresholdOni": EL_NINO_THRESHOLD,
            "fdrQ": FDR_Q,
            "permutations": N_PERM,
            "winterWindow": "DJF 1950-present",
            "winters": max(r["winters"] for r in rows),
            "elNinoWinters": max(r["elNinoWinters"] for r in rows),
            "climateSource": "NOAA NCEI nClimDiv statewide monthly (data/raw/backtest)",
        },
        "directionTest": direction,
        "strengthTest": strength,
        "precipMismatches": [
            {
                "abbr": r["abbr"],
                "label": states[r["abbr"]]["ensoPrecipAnomaly"],
                "measuredDiffPct": r["pcp"]["diff"],
                "qFdr": r["pcp"]["qFdr"],
            }
            for r in rows
            if states[r["abbr"]]["ensoPrecipAnomaly"] in ("above_normal", "below_normal")
            and not sign_ok(states[r["abbr"]]["ensoPrecipAnomaly"], r["pcp"]["diff"])
        ],
        "marketTest": market,
        "states": sorted(rows, key=lambda r: -r["historicalSignal"]),
    }
    (PROCESSED / "backtest_results.json").write_text(json.dumps(out, indent=2))

    if "--apply" in sys.argv:
        path = ROOT / "state_impact.json"
        state_list = json.loads(path.read_text())
        recalibrate(state_list, rows)
        path.write_text(json.dumps(state_list, indent=2, ensure_ascii=False) + "\n")
        print("Recalibrated state_impact.json")

    print(json.dumps({k: out[k] for k in ("directionTest", "strengthTest")}, indent=2))
    print("\nMARKET TEST")
    for m in market:
        print(
            f"  {m['series']:<20} n={m['months']:>3} nino={m['elNinoMonths']:>3} ep={m['elNinoEpisodes']:>2} "
            f"nino {m['meanMonthlyReturnElNinoPct']:+.2f}% vs other {m['meanMonthlyReturnOtherPct']:+.2f}% "
            f"diff {m['diffPct']:+.2f}  p={m['pCircularShift']:.3f} q={m['qFdr']:.3f}"
        )


if __name__ == "__main__":
    main()
