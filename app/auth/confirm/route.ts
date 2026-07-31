import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildRedirectUrl(request: NextRequest, next: string, type: EmailOtpType | null) {
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (type === "recovery" || next === "/reset-password") {
    redirectTo.searchParams.set("recovery", "1");
  }

  return redirectTo;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(request, next, type));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(request, next, type));
    }
  }

  const errorRedirect = request.nextUrl.clone();
  errorRedirect.pathname = "/login";
  errorRedirect.searchParams.set(
    "error",
    "Unable to complete authentication. Please try again.",
  );
  errorRedirect.searchParams.delete("token_hash");
  errorRedirect.searchParams.delete("type");
  errorRedirect.searchParams.delete("next");
  errorRedirect.searchParams.delete("code");

  return NextResponse.redirect(errorRedirect);
}
