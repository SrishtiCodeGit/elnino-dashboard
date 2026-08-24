import { NextResponse } from "next/server";
import { STATE_COORDS } from "@/lib/states";
import { getCurrentWeather } from "@/lib/weather";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/weather/[abbr]">
) {
  const { abbr } = await params;
  const coords = STATE_COORDS[abbr.toUpperCase()];
  if (!coords) {
    return NextResponse.json({ error: "Unknown state abbreviation" }, { status: 404 });
  }

  const weather = await getCurrentWeather(coords.lat, coords.lon, coords.city);
  if (!weather) {
    return NextResponse.json({ error: "Weather data unavailable" }, { status: 502 });
  }
  return NextResponse.json(weather);
}
