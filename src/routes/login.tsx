import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth";

type Search = { redirect?: string; mode?: "signup" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    // Only same-site paths, never an open redirect.
    ...(typeof search["redirect"] === "string" &&
    search["redirect"].startsWith("/") &&
    !search["redirect"].startsWith("//")
      ? { redirect: search["redirect"] }
      : {}),
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "เข้าสู่ระบบ — OneRunAI" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(
    mode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const target = redirect ?? "/app";

  useEffect(() => {
    if (ready && session) window.location.href = target;
  }, [ready, session, target]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error)
        throw new Error(
          error.message === "Invalid login credentials"
            ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            : error.message,
        );
      await navigate({ to: target });
    });
  };

  const signUp = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (password.length < 8) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${target}` },
      });
      if (error) throw new Error(error.message);
      if (data.session) await navigate({ to: target });
      else
        setNotice(
          "เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กดลิงก์ในอีเมลเพื่อเริ่มทดลองใช้ฟรี 5 วัน",
        );
    });
  };

  const forgot = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      setNotice("ถ้าอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว");
    });
  };

  const emailField = (
    <div className="space-y-2">
      <Label htmlFor="email">อีเมล</Label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
    </div>
  );

  const passwordField = (autoComplete: string) => (
    <div className="space-y-2">
      <Label htmlFor="password">รหัสผ่าน</Label>
      <Input
        id="password"
        type="password"
        autoComplete={autoComplete}
        required
        minLength={tab === "signup" ? 8 : undefined}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
    </div>
  );

  const submit = (label: string) => (
    <Button type="submit" className="w-full" disabled={busy}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center">
          <OneRunLogo />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {tab === "forgot" ? (
            <form onSubmit={forgot} className="space-y-4">
              <h1 className="text-lg font-bold">ลืมรหัสผ่าน</h1>
              <p className="text-sm text-muted-foreground">
                กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้
              </p>
              {emailField}
              {submit("ส่งลิงก์ตั้งรหัสผ่านใหม่")}
              <button
                type="button"
                className="w-full text-sm text-primary"
                onClick={() => setTab("signin")}
              >
                กลับไปหน้าเข้าสู่ระบบ
              </button>
            </form>
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">เข้าสู่ระบบ</TabsTrigger>
                <TabsTrigger value="signup">สมัครฟรี</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="mt-4 space-y-4">
                  {emailField}
                  {passwordField("current-password")}
                  {submit("เข้าสู่ระบบ")}
                  <button
                    type="button"
                    className="w-full text-sm text-primary"
                    onClick={() => setTab("forgot")}
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="mt-4 space-y-4">
                  <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    ทดลองใช้ฟรี 5 วัน ไม่ต้องผูกบัตร
                  </p>
                  {emailField}
                  {passwordField("new-password")}
                  {submit("สมัครและเริ่มทดลองใช้")}
                </form>
              </TabsContent>
            </Tabs>
          )}
          {notice && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{notice}</p>}
        </div>
      </div>
    </main>
  );
}
