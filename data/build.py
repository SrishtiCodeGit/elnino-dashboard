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

if __name__ == "__main__":
    build_oni()
    build_generic("financial_markets", "financial_markets.csv")
    build_generic("commodities", "commodities.csv")
    build_generic("crypto", "crypto_prices.csv")
    build_generic("nber_recession", "nber_recession.csv")
    build_events()
    print("Done.")
