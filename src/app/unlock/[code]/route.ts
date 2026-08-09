import { NextRequest, NextResponse } from "next/server";
import { checkCode, cookieSettings, tokenFor } from "@/lib/access";

export const dynamic = "force-dynamic";

// Magic unlock link: /unlock/<code> — open once on a device, the unlock
// cookie is set for 180 days, then you're redirected to the app with full
// data. A wrong code just lands on the trial view (no error page to probe).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const decoded = decodeURIComponent(code || "");
  const res = NextResponse.redirect(new URL("/", req.url));
  if (checkCode(decoded) === "ok") {
    const { name, ...opts } = cookieSettings();
    res.cookies.set(name, tokenFor(decoded), opts);
  }
  return res;
}
