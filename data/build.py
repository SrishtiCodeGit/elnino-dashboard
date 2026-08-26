"""
Converts raw historical CSVs into compact JSON for the Next.js app.
Run: python3 data/build.py
"""
import json
import math
import pandas as pd
from pathlib import Path

RAW = Path(__file__).parent / "raw"
OUT = Path(__file__).parent / "processed"
OUT.mkdir(exist_ok=True)

MONTH = {"DJF":1,"JFM":2,"FMA":3,"MAM":4,"AMJ":5,"MJJ":6,
         "JJA":7,"JAS":8,"ASO":9,"SON":10,"OND":11,"NDJ":12}

EL_NINO_EVENTS = [
    {"start": "1972-06-01", "end": "1973-03-01", "label": "1972-73"},
    {"start": "1982-06-01", "end": "1983-06-01", "label": "1982-83 Super"},
    {"start": "1997-04-01", "end": "1998-05-01", "label": "1997-98 Super"},
    {"start": "2015-04-01", "end": "2016-05-01", "label": "2015-16 Super"},
    {"start": "2023-06-01", "end": "2024-03-01", "label": "2023-24"},
]

def clean_records(df, date_col="date"):
    records = []
    for idx, row in df.iterrows():
        d = idx if date_col == "index" else row[date_col]
        rec = {"date": str(d.date()) if hasattr(d, "date") else str(d)}
        for col in df.columns:
            if col == date_col:
                continue
            v = row[col]
            if hasattr(v, "item"):
                v = v.item()
            rec[col] = None if (isinstance(v, float) and math.isnan(v)) else v
        records.append(rec)
    return records

def build_oni():
    df = pd.read_csv(RAW / "oni_enso.csv")
    df["month"] = df["season"].map(MONTH)
    df["date"] = pd.to_datetime(dict(year=df["year"], month=df["month"], day=1))
    df = df.set_index("date").sort_index()
    df = df.drop(columns=["month"])
    records = clean_records(df, date_col="index")
    (OUT / "oni.json").write_text(json.dumps(records))
    print(f"oni.json: {len(records)} records")

def build_generic(name, fname):
    df = pd.read_csv(RAW / fname, parse_dates=["date"], index_col="date").sort_index()
    records = clean_records(df, date_col="index")
    (OUT / f"{name}.json").write_text(json.dumps(records))
    print(f"{name}.json: {len(records)} records")

def build_events():
    (OUT / "el_nino_events.json").write_text(json.dumps(EL_NINO_EVENTS, indent=2))
    print(f"el_nino_events.json: {len(EL_NINO_EVENTS)} events")

# Maps BTS/ORNL FAF6 zone codes to their state — small states are a single
# zone, populous states are split into metro zones + "Rest of X". Sourced
# directly from the FAF6 Data Tabulation Tool's own origin/destination
# picker (faf.ornl.gov/faf6/dtt_total.aspx) — see
# data/supply_chain_flows_README.md for the full sourcing writeup.
FAF_ZONE_TO_STATE = {
    "011": "AL", "012": "AL", "019": "AL",
    "020": "AK",
    "041": "AZ", "042": "AZ", "049": "AZ",
    "050": "AR",
    "061": "CA", "062": "CA", "063": "CA", "064": "CA", "065": "CA", "069": "CA",
    "081": "CO", "089": "CO",
    "091": "CT", "092": "CT", "099": "CT",
    "101": "DE", "109": "DE",
    "111": "DC",
    "121": "FL", "122": "FL", "123": "FL", "124": "FL", "129": "FL",
    "131": "GA", "132": "GA", "139": "GA",
    "151": "HI", "159": "HI",
    "160": "ID",
    "171": "IL", "172": "IL", "179": "IL",
    "181": "IN", "182": "IN", "183": "IN", "189": "IN",
    "191": "IA", "199": "IA",
    "201": "KS", "202": "KS", "209": "KS",
    "211": "KY", "212": "KY", "219": "KY",
    "221": "LA", "222": "LA", "223": "LA", "229": "LA",
    "230": "ME",
    "241": "MD", "242": "MD", "249": "MD",
    "251": "MA", "259": "MA",
    "261": "MI", "262": "MI", "269": "MI",
    "271": "MN", "279": "MN",
    "280": "MS",
    "291": "MO", "292": "MO", "299": "MO",
    "300": "MT",
    "311": "NE", "319": "NE",
    "321": "NV", "329": "NV",
    "331": "NH", "339": "NH",
    "341": "NJ", "342": "NJ",
    "350": "NM",
    "361": "NY", "362": "NY", "363": "NY", "364": "NY", "369": "NY",
    "371": "NC", "372": "NC", "373": "NC", "379": "NC",
    "380": "ND",
    "391": "OH", "392": "OH", "393": "OH", "394": "OH", "395": "OH", "399": "OH",
    "401": "OK", "402": "OK", "409": "OK",
    "411": "OR", "419": "OR",
    "421": "PA", "422": "PA", "423": "PA", "429": "PA",
    "441": "RI",
    "451": "SC", "452": "SC", "459": "SC",
    "460": "SD",
    "471": "TN", "472": "TN", "473": "TN", "479": "TN",
    "481": "TX", "482": "TX", "483": "TX", "484": "TX", "485": "TX",
    "486": "TX", "487": "TX", "488": "TX", "489": "TX",
    "491": "UT", "499": "UT",
    "500": "VT",
    "511": "VA", "512": "VA", "513": "VA", "519": "VA",
    "531": "WA", "532": "WA", "539": "WA",
    "540": "WV",
    "551": "WI", "559": "WI",
    "560": "WY",
}

# SCTG2 commodity codes selected to map onto the commodities already
# tracked elsewhere in this project (see supply_chain_flows_README.md for
# the reasoning and known gaps, e.g. Coffee/Cocoa excluded).
SCTG_TO_COMMODITY = {
    "02": "Cereal grains",
    "03": "Other ag products",
    "05": "Meat & seafood",
    "14": "Metallic ores",
    "16": "Crude petroleum",
    "19": "Natural gas & fossil products",
}

def build_supply_chain_flows(top_n_per_commodity=10):
    df = pd.read_csv(RAW / "supply_chain_flows.csv")
    df.columns = ["dms_orig", "dms_dest", "sctg2", "value"]
    df["orig_state"] = df["dms_orig"].str.split("-").str[0].map(FAF_ZONE_TO_STATE)
    df["dest_state"] = df["dms_dest"].str.split("-").str[0].map(FAF_ZONE_TO_STATE)
    df["commodity_code"] = df["sctg2"].str.split("-").str[0]
    df = df.dropna(subset=["orig_state", "dest_state"])
    df = df[df["orig_state"] != df["dest_state"]]  # interstate flows only

    grouped = df.groupby(["orig_state", "dest_state", "commodity_code"], as_index=False)["value"].sum()

    # Top N per commodity, not a global top N — natural gas and crude
    # petroleum dollar values dwarf agricultural commodities by 5-10x, so a
    # single global ranking would silently drop cereal grains/meat/seafood
    # entirely. Selecting per commodity keeps every tracked category
    # represented on the map, matching how the rest of this dashboard
    # already treats commodities as distinct tracked categories.
    top = (
        grouped.sort_values("value", ascending=False)
        .groupby("commodity_code", group_keys=False)
        .head(top_n_per_commodity)
    )

    records = [
        {
            "origin": row.orig_state,
            "destination": row.dest_state,
            "commodityCode": row.commodity_code,
            "commodityName": SCTG_TO_COMMODITY[row.commodity_code],
            "valueUsdMillions": round(row.value, 2),
        }
        for row in top.itertuples()
    ]
    (OUT / "supply_chain_flows.json").write_text(json.dumps(records))
    print(f"supply_chain_flows.json: {len(records)} records (top {top_n_per_commodity}/commodity of {len(df)} interstate rows)")

VALID_STATE_ABBRS = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY", "DC",
}

def build_wildfire_stats():
    df = pd.read_csv(RAW / "wildfire_perimeters.csv")
    df["state"] = df["UNIT_ID"].astype(str).str[:2].str.upper()
    # ~0.15% of UNIT_ID prefixes don't match a real state postal code (a
    # handful of numeric BLM district codes) — dropped rather than guessed.
    # See data/wildfire_stats_README.md.
    df = df[df["state"].isin(VALID_STATE_ABBRS)]
    df = df.dropna(subset=["GIS_ACRES", "FIRE_YEAR_INT"])

    years_covered = int(df["FIRE_YEAR_INT"].max() - df["FIRE_YEAR_INT"].min() + 1)
    by_state = df.groupby("state").agg(total_acres=("GIS_ACRES", "sum"), fire_count=("GIS_ACRES", "count"))

    records = [
        {
            "abbr": abbr,
            "avgAnnualAcres": round(row.total_acres / years_covered, 1),
            "fireCount": int(row.fire_count),
            "yearsCovered": years_covered,
        }
        for abbr, row in by_state.iterrows()
    ]
    records.sort(key=lambda r: r["avgAnnualAcres"], reverse=True)
    (OUT / "wildfire_by_state.json").write_text(json.dumps(records))
    print(f"wildfire_by_state.json: {len(records)} states (from {len(df)} fire perimeters, {years_covered} years)")

# NIFC's InterAgencyFirePerimeterHistory archive only holds *finalized*
# perimeters — recent seasons take a year or more to be QA'd and added, so
# the raw per-year fire count collapses from ~1,500-3,300/year (2005-2019)
# to 28-101/year (2020-2024): a data-completeness artifact, not a real
# decline (2020-2023 were severe US wildfire seasons). Plotting the raw
# tail would show fires "nearly stopping," which is false. Cut at 2019 —
# the last year whose count is in the normal range — rather than caveat an
# actively misleading chart. See data/wildfire_stats_README.md.
WILDFIRE_YEAR_COMPLETE_THROUGH = 2019

def build_wildfire_by_year():
    # Same raw fire-perimeter records as build_wildfire_stats(), aggregated
    # by year instead of by state — a real national acres-burned-per-year
    # trend for the "See Details" chart, not a new dataset.
    df = pd.read_csv(RAW / "wildfire_perimeters.csv")
    df = df.dropna(subset=["GIS_ACRES", "FIRE_YEAR_INT"])
    df = df[df["FIRE_YEAR_INT"] <= WILDFIRE_YEAR_COMPLETE_THROUGH]
    by_year = df.groupby("FIRE_YEAR_INT").agg(total_acres=("GIS_ACRES", "sum"), fire_count=("GIS_ACRES", "count"))

    records = [
        {
            "year": int(year),
            "totalAcres": round(row.total_acres, 1),
            "fireCount": int(row.fire_count),
        }
        for year, row in by_year.iterrows()
    ]
    records.sort(key=lambda r: r["year"])
    (OUT / "wildfire_by_year.json").write_text(json.dumps(records))
    print(f"wildfire_by_year.json: {len(records)} years (through {WILDFIRE_YEAR_COMPLETE_THROUGH}, later years excluded as incomplete)")

if __name__ == "__main__":
    build_oni()
    build_generic("financial_markets", "financial_markets.csv")
    build_generic("commodities", "commodities.csv")
    build_generic("crypto", "crypto_prices.csv")
    build_generic("nber_recession", "nber_recession.csv")
    build_generic("livestock_prices", "livestock_prices.csv")
    build_events()
    build_supply_chain_flows()
    build_wildfire_stats()
    build_wildfire_by_year()
    print("Done.")
