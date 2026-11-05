import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pb_session";

/**
 * Cheap edge-of-app gate: unauthenticated visitors never see the editor or
 * dashboard shell. Real authorization still happens in the route handlers on every API
 * call, so a forged cookie can't read or write anything.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/settings/:path*", "/p/:id/edit"],
};
