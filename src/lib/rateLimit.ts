import { NextResponse } from "next/server";

// Sliding-window limiter held in memory. On serverless each warm instance
// keeps its own counters, so this is a best-effort first line of defence
// (it stops a single client hammering one instance), not a global quota.
const hits = new Map<string, number[]>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Returns a 429 response when `name` has been called more than `limit`
 * times by this client within `windowMs`, otherwise null. */
export function rateLimit(request: Request, name: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const key = `${name}:${clientIp(request)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < windowMs)) hits.delete(k);
    }
  }
  return null;
}
