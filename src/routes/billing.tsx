import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Clock, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getPricing, quotePrice, submitPayment, type PaidPlanId } from "@/lib/account.functions";
import { daysLeft, formatKip, formatMinutes, PLAN_LABELS } from "@/lib/account-shared";
import { useAccount, useSession } from "@/lib/auth";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "แพ็กเกจ — OneRunAI" }] }),
  component: BillingPage,
});

const MAX_SLIP_BYTES = 5 * 1024 * 1024;

function BillingPage() {
  const { session, ready } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const account = useAccount(!!session);
  const fetchPricing = useServerFn(getPricing);
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing() });
  const quote = useServerFn(quotePrice);
  const submit = useServerFn(submitPayment);

  const [plan, setPlan] = useState<PaidPlanId>("monthly");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    amountKip: number;
    plan: PaidPlanId;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/login", search: { redirect: "/billing" } });
  }, [ready, session, navigate]);

  // Re-quote when the plan changes under an applied code.
  useEffect(() => {
    if (!applied || applied.plan === plan) return;
    void quote({ data: { plan, code: applied.code } }).then((result) =>
      setApplied(result.code ? { code: result.code, amountKip: result.amountKip, plan } : null),
    );
  }, [plan, applied, quote]);

  const selected = pricing.data?.plans.find((item) => item.id === plan);
  const amount = applied?.plan === plan ? applied.amountKip : (selected?.priceKip ?? 0);
  const settings = pricing.data?.settings;
  const pending = account.data?.payments.find((payment) => payment.status === "pending");

  const applyCode = async () => {
    if (!code.trim()) return;
    setChecking(true);
    try {
      const result = await quote({ data: { plan, code } });
      if (result.message || !result.code) {
        setApplied(null);
        toast.error(result.message ?? "ใช้โค้ดนี้ไม่ได้");
      } else {
        setApplied({ code: result.code, amountKip: result.amountKip, plan });
        toast.success(`ใช้โค้ด ${result.code} แล้ว จ่ายเพียง ${formatKip(result.amountKip)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ตรวจโค้ดไม่สำเร็จ");
    } finally {
      setChecking(false);
    }
  };

  const sendSlip = async () => {
    if (!slip || !session) return;
    if (!slip.type.startsWith("image/")) {
      toast.error("กรุณาอัปโหลดรูปสลิป (JPG/PNG)");
      return;
    }
    if (slip.size > MAX_SLIP_BYTES) {
      toast.error("ไฟล์ใหญ่เกิน 5MB");
      return;
    }
    setSending(true);
    try {
      const ext =
        slip.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("payment-slips")
        .upload(path, slip, { contentType: slip.type, upsert: false });
      if (error) throw new Error(`อัปโหลดสลิปไม่สำเร็จ: ${error.message}`);
      await submit({
        data: { plan, slipPath: path, ...(applied?.plan === plan ? { code: applied.code } : {}) },
      });
      toast.success("ส่งสลิปเรียบร้อย ระบบจะเปิดใช้งานหลังผู้ดูแลตรวจสอบ");
      setSlip(null);
      await queryClient.invalidateQueries({ queryKey: ["account"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  if (!ready || !session || account.isLoading || pricing.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = account.data;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <Link to="/">
          <OneRunLogo />
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/app">
            <ArrowLeft className="mr-2 h-4 w-4" /> กลับไปที่แอป
          </Link>
        </Button>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        {status && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h1 className="text-lg font-bold">บัญชีของคุณ</h1>
            <p className="mt-1 text-sm text-muted-foreground">{status.email}</p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">สถานะ</div>
                <div className="font-semibold">
                  {status.status === "paid"
                    ? `แพ็กเกจ${PLAN_LABELS[status.plan ?? ""] ?? ""}`
                    : status.status === "trial"
                      ? "ทดลองใช้ฟรี"
                      : "หมดอายุ"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">ใช้ได้ถึง</div>
                <div className="font-semibold">
                  {status.endsAt ? new Date(status.endsAt).toLocaleDateString("th-TH") : "-"}
                  {status.status !== "expired" && ` (อีก ${daysLeft(status.endsAt)} วัน)`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">AI คงเหลือ</div>
                <div className="font-semibold">
                  {status.status === "expired"
                    ? "-"
                    : `${formatMinutes(status.quotaSeconds - status.usedSeconds)} / ${formatMinutes(status.quotaSeconds)}`}
                </div>
              </div>
            </div>
          </section>
        )}

        {pending && (
          <section className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-5 text-sm">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <div className="font-semibold">กำลังตรวจสอบสลิปของคุณ</div>
              <div className="text-muted-foreground">
                แพ็กเกจ{PLAN_LABELS[pending.plan]} {formatKip(pending.amountKip)} —
                ระบบจะเปิดใช้งานทันทีที่ผู้ดูแลอนุมัติ
              </div>
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-bold">1. เลือกแพ็กเกจ</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pricing.data?.plans.map((item) => {
              const monthlyPrice =
                pricing.data?.plans.find((p) => p.id === "monthly")?.priceKip ?? 0;
              const saving = item.id === "yearly" ? monthlyPrice * 12 - item.priceKip : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPlan(item.id)}
                  className={cn(
                    "rounded-2xl border bg-card p-5 text-left transition",
                    plan === item.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.name}</span>
                    {plan === item.id && <Check className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="mt-2 text-2xl font-bold">{formatKip(item.priceKip)}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.id === "yearly" ? "ต่อปี" : "ต่อเดือน"} · AI{" "}
                    {formatMinutes(item.quotaSeconds)}/เดือน
                  </div>
                  {saving > 0 && (
                    <div className="mt-2 text-xs font-semibold text-primary">
                      ประหยัด {formatKip(saving)} ต่อปี
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="โค้ดส่วนลด (ถ้ามี)"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              className="max-w-xs uppercase"
            />
            <Button
              variant="secondary"
              onClick={() => void applyCode()}
              disabled={checking || !code.trim()}
            >
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ใช้โค้ด
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">2. โอนเงินผ่าน QR</h2>
          <div className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[220px_1fr]">
            {settings?.paymentQrUrl ? (
              <img
                src={settings.paymentQrUrl}
                alt="QR สำหรับโอนเงิน"
                className="mx-auto w-full max-w-[220px] rounded-xl bg-white p-2"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl bg-muted p-4 text-center text-xs text-muted-foreground">
                ผู้ดูแลยังไม่ได้ตั้งค่า QR
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">ยอดที่ต้องโอน</div>
              <div className="text-3xl font-bold text-primary">{formatKip(amount)}</div>
              {applied?.plan === plan && selected && (
                <div className="text-xs text-muted-foreground">
                  <span className="line-through">{formatKip(selected.priceKip)}</span> ใช้โค้ด{" "}
                  {applied.code}
                </div>
              )}
              {settings?.bankName && <div>ธนาคาร: {settings.bankName}</div>}
              {settings?.accountName && <div>ชื่อบัญชี: {settings.accountName}</div>}
              {settings?.accountNumber && <div>เลขบัญชี: {settings.accountNumber}</div>}
              {settings?.contact && (
                <div className="text-muted-foreground">ติดต่อ: {settings.contact}</div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">3. อัปโหลดสลิป</h2>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <Label htmlFor="slip">รูปสลิปการโอน</Label>
            <Input
              id="slip"
              type="file"
              accept="image/*"
              onChange={(event) => setSlip(event.target.files?.[0] ?? null)}
            />
            <Button
              onClick={() => void sendSlip()}
              disabled={!slip || sending}
              className="w-full sm:w-auto"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              ส่งสลิป {formatKip(amount)}
            </Button>
          </div>
        </section>

        {!!status?.payments.length && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">ประวัติการชำระเงิน</h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {status.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 p-4 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {PLAN_LABELS[payment.plan]} · {formatKip(payment.amountKip)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleString("th-TH")}
                      {payment.adminNote ? ` · ${payment.adminNote}` : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold",
                      payment.status === "approved" && "text-primary",
                      payment.status === "rejected" && "text-destructive",
                    )}
                  >
                    {payment.status === "approved" ? (
                      <Check className="h-4 w-4" />
                    ) : payment.status === "rejected" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                    {payment.status === "approved"
                      ? "อนุมัติแล้ว"
                      : payment.status === "rejected"
                        ? "ไม่อนุมัติ"
                        : "รอตรวจ"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
