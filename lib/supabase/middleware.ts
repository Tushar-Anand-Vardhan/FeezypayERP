import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  fetchAuthGateState,
  isAuthRoute,
  isProtectedAppRoute,
  resolveAuthenticatedRouteRedirect,
} from "@/lib/auth/routing";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (isProtectedAppRoute(pathname) && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated) {
    const gate = await fetchAuthGateState(supabase);
    const redirectPath = resolveAuthenticatedRouteRedirect(
      pathname,
      gate.onboardingStatus,
      gate,
    );

    if (redirectPath) {
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Honor ?next= when landing on login while already authenticated is handled by resolve
    if (isAuthRoute(pathname) && pathname === "/login") {
      const next = request.nextUrl.searchParams.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        const dest = resolveAuthenticatedRouteRedirect(next, gate.onboardingStatus, gate);
        const url = request.nextUrl.clone();
        url.pathname = dest ?? next;
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
