import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Sign-in for one test account without the Cloudflare check, so Claude's
 * browser (which Cloudflare flags as a bot) can use the app. Off unless both
 * TEST_LOGIN_EMAIL and TEST_LOGIN_SECRET (32+ characters) are set, and never
 * for an admin account.
 */
export async function testLogin(secret: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const email = process.env["TEST_LOGIN_EMAIL"]?.trim();
  const expected = process.env["TEST_LOGIN_SECRET"] ?? "";
  const refused = new Error("เข้าสู่ระบบทดสอบไม่สำเร็จ");
  if (!email || expected.length < 32) throw refused;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(secret), digest(expected))) throw refused;

  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !link.user || !link.properties?.hashed_token) throw refused;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", link.user.id)
    .maybeSingle();
  if (!profile || profile.is_admin) throw refused;

  // Exchange the one-time link for a session, as clicking it would.
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw refused;
  const res = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: link.properties.hashed_token }),
  });
  const session = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
  } | null;
  if (!res.ok || !session?.access_token || !session.refresh_token) throw refused;
  return { accessToken: session.access_token, refreshToken: session.refresh_token };
}
