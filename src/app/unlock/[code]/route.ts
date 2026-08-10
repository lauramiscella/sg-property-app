import { NextRequest, NextResponse } from "next/server";
import { checkCode, cookieSettings, tokenFor } from "@/lib/access";
import { limited, logAuthFailure } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Magic unlock link: /unlock/<code> — open once on a device, the unlock
// cookie is set for 180 days, then you're redirected to the app with full
// data. A wrong code just lands on the trial view (no error page to probe).
// Shares the unlock rate-limit bucket (10 attempts / 15 min per IP).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = limited(req, "unlock");
  if (rl) return rl;
  const { code } = await params;
  const decoded = decodeURIComponent(code || "").slice(0, 200);
  const res = NextResponse.redirect(new URL("/", req.url));
  const result = checkCode(decoded);
  if (result === "ok") {
    const { name, ...opts } = cookieSettings();
    res.cookies.set(name, tokenFor(decoded), opts);
  } else if (result === "wrong") {
    logAuthFailure(req, "magic-link");
  }
  return res;
}
