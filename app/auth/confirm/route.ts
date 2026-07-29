import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildRedirectUrl(request: NextRequest, next: string, type: EmailOtpType | null) {
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (type === "recovery") {
    redirectTo.searchParams.set("recovery", "1");
  }

  return redirectTo;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
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

  return NextResponse.redirect(errorRedirect);
}
