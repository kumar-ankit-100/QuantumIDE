// middleware.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const PUBLIC_PATHS = ["/login", "/register", "/api/auth"];
  
  // Get JWT token from cookie (NextAuth)
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  // console.log("Middleware token:", token);
  const pathname = req.nextUrl.pathname;

  // 1️⃣ Redirect logged-in users away from login/registerv
  if (token && (pathname === "/login" || pathname === "/register")) {
    const homeUrl = new URL("/", req.url);
    return NextResponse.redirect(homeUrl);
  }

  // 2️⃣ Allow public paths without auth
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 3️⃣ If token doesn't exist → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4️⃣ Token exists → allow access
  return NextResponse.next();
}

// Apply middleware only to protected routes
export const config = {
  matcher: ["/dashboard/:path*", "/ide/:path*", "/login", "/register","/"],
};
