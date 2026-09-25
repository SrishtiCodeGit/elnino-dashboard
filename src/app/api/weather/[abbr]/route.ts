import { NextResponse } from "next/server";
import { STATE_COORDS } from "@/lib/states";
import { getCurrentWeather } from "@/lib/weather";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/weather/[abbr]">
) {
  const limited = rateLimit(request, "weather", 60, 10 * 60 * 1000);
  if (limited) return limited;

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
