import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "ตั้งรหัสผ่านใหม่ — OneRunAI" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  // The recovery link signs the user in, so a session exists here.
  const { session, ready } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("ตั้งรหัสผ่านใหม่เรียบร้อย");
    await navigate({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center">
          <OneRunLogo />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {!ready ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : !session ? (
            <div className="space-y-4 text-center text-sm">
              <p>ลิงก์นี้หมดอายุหรือใช้ไปแล้ว</p>
              <Button asChild className="w-full">
                <Link to="/login">ขอลิงก์ใหม่</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <h1 className="text-lg font-bold">ตั้งรหัสผ่านใหม่</h1>
              <div className="space-y-2">
                <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                บันทึกรหัสผ่าน
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
