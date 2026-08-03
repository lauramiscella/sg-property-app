import { NextRequest, NextResponse } from "next/server";
import { checkCode, cookieSettings, tokenFor, ACCESS_COOKIE } from "@/lib/access";

export const dynamic = "force-dynamic";

// POST { code } — verify the access code and set the unlock cookie.
export async function POST(req: NextRequest) {
  let code = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "");
  } catch {
    /* fall through with empty code */
  }
  const result = checkCode(code);
  if (result === "open") return NextResponse.json({ ok: true, open: true });
  if (result === "wrong") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  const { name, ...opts } = cookieSettings();
  res.cookies.set(name, tokenFor(code), opts);
  return res;
}

// DELETE — drop back to trial (mainly for testing).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
