import { type NextRequest, NextResponse } from "next/server";

const DEMO_ONLY = process.env.DEMO_ONLY === "true";

export function proxy(request: NextRequest) {
  if (!DEMO_ONLY) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/game")) {
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/game", "/game/:path*"],
};
