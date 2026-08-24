// Fetches historical Treasury yield data via Yahoo Finance (^TNX = 10Y, ^TYX = 30Y)
// and merges it into data/processed/bonds.json. Run: node data/fetch-bonds.mjs
import YahooFinance from "yahoo-finance2";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "processed", "bonds.json");

async function main() {
  const [tnx, tyx] = await Promise.all([
    yf.chart("^TNX", { period1: "1990-01-01", interval: "1d" }),
    yf.chart("^TYX", { period1: "1990-01-01", interval: "1d" }),
  ]);

  const byDate = new Map();
  for (const q of tnx.quotes) {
    if (q.close == null) continue;
    const date = q.date.toISOString().slice(0, 10);
    byDate.set(date, { date, DGS10: q.close, DGS30: null });
  }
  for (const q of tyx.quotes) {
    if (q.close == null) continue;
    const date = q.date.toISOString().slice(0, 10);
    const existing = byDate.get(date) ?? { date, DGS10: null, DGS30: null };
    existing.DGS30 = q.close;
    byDate.set(date, existing);
  }

  const records = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(OUT, JSON.stringify(records));
  console.log(`bonds.json: ${records.length} records (${records[0]?.date} to ${records.at(-1)?.date})`);
}

main().catch((e) => {
  console.error("Failed to fetch bond data:", e.message);
  process.exit(1);
});
