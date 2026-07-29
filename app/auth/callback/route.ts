import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectTo = new URL(`${origin}${next}`);
      if (next === "/reset-password") {
        redirectTo.searchParams.set("recovery", "1");
      }
      return NextResponse.redirect(redirectTo.toString());
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Unable+to+complete+authentication.+Please+try+again.`,
  );
}
