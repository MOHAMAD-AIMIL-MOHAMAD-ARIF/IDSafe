import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_LOGIN_PATHS = new Set(["/admin/login", "/admin/login/start", "/admin/login/verify-otp"]);

function getBackendOrigin() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ADMIN_LOGIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${getBackendOrigin()}/auth/session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login/start";
      return NextResponse.redirect(loginUrl);
    }

    const session = (await response.json()) as { role?: string };

    if (session.role !== "ADMIN") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login/start";
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login/start";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
