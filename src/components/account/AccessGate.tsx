import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { useAccount, useSession, useSignOut } from "@/lib/auth";

function CenteredSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Renders children only for signed-in users with an active trial or plan. */
export function AccessGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const navigate = useNavigate();
  const account = useAccount(!!session);
  const signOut = useSignOut();

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/login", search: { redirect: "/app" } });
  }, [ready, session, navigate]);

  if (!ready || !session || account.isLoading) return <CenteredSpinner />;

  if (account.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          โหลดข้อมูลบัญชีไม่สำเร็จ: {account.error instanceof Error ? account.error.message : ""}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void account.refetch()}>ลองอีกครั้ง</Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            ออกจากระบบ
          </Button>
        </div>
      </div>
    );
  }

  if (account.data?.status === "expired") {
    const pending = account.data.payments.some((payment) => payment.status === "pending");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <OneRunLogo className="justify-center" />
          <Lock className="mx-auto mt-6 h-10 w-10 text-primary" />
          <h1 className="mt-4 text-xl font-bold">ช่วงทดลองใช้ของคุณหมดแล้ว</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pending
              ? "เราได้รับสลิปของคุณแล้ว กำลังรอผู้ดูแลตรวจสอบ ระบบจะเปิดใช้งานให้ทันทีที่อนุมัติ"
              : "สมัครแพ็กเกจเพื่อใช้งาน OneRunAI ต่อ ข้อมูลโปรเจกต์ในเครื่องของคุณยังอยู่ครบ"}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link to="/billing">{pending ? "ดูสถานะการชำระเงิน" : "เลือกแพ็กเกจ"}</Link>
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
