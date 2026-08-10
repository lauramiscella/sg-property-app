// Minimal per-IP rate limiting + auth-failure logging.
//
// In-memory fixed-window buckets. On serverless this is per-instance (resets
// on cold start), which is exactly what's needed against the realistic threat
// here: bursts of automated requests hammering one warm instance. It is not a
// distributed quota system and doesn't pretend to be.
import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // memory backstop

export function ipOf(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first hop is the client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function take(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // prune expired entries before giving up
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

// Returns a 429 response when over the limit, or null to proceed.
// Buckets: "data" (all read APIs), "unlock" (code attempts), "refresh" (URA pulls).
export function limited(
  req: NextRequest,
  bucket: "data" | "unlock" | "refresh"
): NextResponse | null {
  const cfg = {
    data: { limit: 120, windowMs: 60_000 }, // 120 requests/min per IP
    unlock: { limit: 10, windowMs: 15 * 60_000 }, // 10 code attempts/15 min per IP
    refresh: { limit: 3, windowMs: 60 * 60_000 }, // 3 URA pulls/hour per IP
  }[bucket];
  const ip = ipOf(req);
  const r = take(`${bucket}:${ip}`, cfg.limit, cfg.windowMs);
  if (r.ok) return null;
  if (bucket !== "data") {
    console.warn(`[security] rate limit hit — bucket=${bucket} ip=${ip}`);
  }
  return NextResponse.json(
    { error: "Too many requests — slow down." },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } }
  );
}

// Failed-auth log line (shows up in Vercel → project → Logs). Never logs the
// attempted code itself — only that an attempt failed, from where.
export function logAuthFailure(req: NextRequest, surface: string): void {
  console.warn(
    `[security] FAILED unlock attempt — surface=${surface} ip=${ipOf(req)} ua="${(req.headers.get("user-agent") ?? "").slice(0, 80)}" at=${new Date().toISOString()}`
  );
}
