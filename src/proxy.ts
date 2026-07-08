import { type NextRequest, NextResponse } from "next/server";

// demo-prod branch: /game is always redirected to /demo — no env var needed.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/game")) {
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/game", "/game/:path*"],
};
