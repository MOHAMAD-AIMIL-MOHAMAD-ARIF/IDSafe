import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type AuthSession = {
  role?: string;
};

function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function getBackendOrigin() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  );
}

async function fetchAdminSession(request: NextRequest): Promise<AuthSession | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  const response = await fetch(`${getBackendOrigin()}/auth/session`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as AuthSession;
  return data;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminLoginPath(pathname)) {
    return NextResponse.next();
  }

  const session = await fetchAdminSession(request);
  if (session?.role === "ADMIN") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login/start";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
