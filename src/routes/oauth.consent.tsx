/**
 * "Allow Claude to use your OneRun account" — the page Supabase's OAuth
 * server sends people to when they connect the OneRun connector in Claude
 * (Authentication → OAuth Server → Authorization Path = /oauth/consent).
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { trustedRedirect } from "@/lib/oauth-redirect";

type Search = { authorization_id?: string };

type Details = {
  authorizationId: string;
  clientName: string;
  redirectUri: string;
  email: string;
};

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["authorization_id"] === "string"
      ? { authorization_id: search["authorization_id"] }
      : {},
  head: () => ({ meta: [{ title: "เชื่อมต่อ Claude — OneRunAI" }] }),
  component: ConsentPage,
});

function ConsentPage() {
  const { authorization_id: authorizationId } = Route.useSearch();
  const { session, ready } = useSession();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authorizationId) {
      setError("ลิงก์ไม่ครบ กรุณากดเชื่อมต่อจากในแอป Claude อีกครั้ง");
      return;
    }
    if (!session) {
      const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
      window.location.href = `/login?redirect=${encodeURIComponent(back)}`;
      return;
    }
    let alive = true;
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) {
        setError("คำขอนี้หมดอายุหรือไม่ถูกต้อง กรุณากดเชื่อมต่อจากในแอป Claude อีกครั้ง");
        return;
      }
      // Allowed before: Supabase sends us straight back to Claude.
      if (!("authorization_id" in data)) {
        window.location.href = data.redirect_url;
        return;
      }
      setDetails({
        authorizationId: data.authorization_id,
        clientName: data.client.name || "แอปที่ไม่ระบุชื่อ",
        redirectUri: data.redirect_uri,
        email: data.user.email,
      });
    });
    return () => {
      alive = false;
    };
  }, [ready, session, authorizationId]);

  const decide = async (approve: boolean, { follow = true } = {}) => {
    if (!details) return;
    setBusy(true);
    const api = supabase.auth.oauth;
    const { data, error } = approve
      ? await api.approveAuthorization(details.authorizationId, { skipBrowserRedirect: true })
      : await api.denyAuthorization(details.authorizationId, { skipBrowserRedirect: true });
    if (error || !data) {
      setBusy(false);
      setError(error?.message ?? "ทำรายการไม่สำเร็จ กรุณาลองใหม่");
      return;
    }
    // An untrusted app's address is never opened, even with the refusal.
    window.location.href = follow ? data.redirect_url : "/";
  };

  const trust = details ? trustedRedirect(details.redirectUri) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center">
          <OneRunLogo />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !details ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !trust ? (
            <div className="space-y-4">
              <h1 className="text-lg font-bold">ไม่อนุญาตคำขอนี้</h1>
              <p className="text-sm text-muted-foreground">
                “{details.clientName}” ขอเข้าใช้บัญชีของคุณ แต่จะส่งการเข้าสู่ระบบไปที่{" "}
                <span className="break-all font-medium text-foreground">{details.redirectUri}</span>{" "}
                ซึ่งไม่ใช่ Claude เพื่อความปลอดภัยของบัญชี OneRun จึงไม่อนุญาต
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void decide(false, { follow: false })}
              >
                ปิด
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold">อนุญาตให้ {details.clientName} ใช้ OneRun?</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {trust === "claude"
                  ? "Claude จะทำซับจากคลิปของคุณด้วย OneRun ได้"
                  : "แอปบนเครื่องนี้ (เช่น Claude Code) จะทำซับจากคลิปของคุณด้วย OneRun ได้"}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>ถอดเสียงเป็นซับลาว ไทย หรืออังกฤษ</li>
                <li>ใช้โควตาในแพ็กเกจ OneRun ของคุณ เหมือนใช้บนเว็บ</li>
                <li>ดูสถานะแพ็กเกจและโควตาที่เหลือ</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                บัญชี: {details.email} · ยกเลิกการเชื่อมต่อได้ทุกเมื่อที่หน้า “แพ็กเกจ”
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
                  ไม่อนุญาต
                </Button>
                <Button disabled={busy} onClick={() => void decide(true)}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  อนุญาต
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
