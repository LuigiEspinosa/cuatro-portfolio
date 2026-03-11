import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// UX Layer only
// The real security gate is (app)/layout.tsx which
//        calls auth.api.getSession()
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except auth pages, API routes, static assets, and demo.
  matcher: [
    "/((?!api/auth|demo|_next/static|_next/image|favicon\\.ico|login|setup-mfa|verify-mfa).*)",
  ],
};
