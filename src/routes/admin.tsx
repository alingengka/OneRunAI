import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminListPayments,
  adminListPromoCodes,
  adminReviewPayment,
  adminSavePromoCode,
  adminUpdateSettings,
  getPricing,
} from "@/lib/account.functions";
import { formatKip, PLAN_LABELS } from "@/lib/account-shared";
import { useAccount, useSession } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "ผู้ดูแลระบบ — OneRunAI" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { session, ready } = useSession();
  const navigate = useNavigate();
  const account = useAccount(!!session);

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/login", search: { redirect: "/admin" } });
  }, [ready, session, navigate]);

  if (!ready || !session || account.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!account.data?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        <Button asChild>
          <Link to="/app">กลับไปที่แอป</Link>
        </Button>
      </div>
    );
  }

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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-xl font-bold">ผู้ดูแลระบบ</h1>
        <Tabs defaultValue="pending">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="pending">สลิปรอตรวจ</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
            <TabsTrigger value="rejected">ไม่อนุมัติ</TabsTrigger>
            <TabsTrigger value="settings">ตั้งค่าการรับเงิน</TabsTrigger>
            <TabsTrigger value="promo">โค้ดส่วนลด</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <PaymentList status="pending" />
          </TabsContent>
          <TabsContent value="approved">
            <PaymentList status="approved" />
          </TabsContent>
          <TabsContent value="rejected">
            <PaymentList status="rejected" />
          </TabsContent>
          <TabsContent value="settings">
            <PaymentSettings />
          </TabsContent>
          <TabsContent value="promo">
            <PromoCodes />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function PaymentList({ status }: { status: "pending" | "approved" | "rejected" }) {
  const list = useServerFn(adminListPayments);
  const review = useServerFn(adminReviewPayment);
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["admin-payments", status],
    queryFn: () => list({ data: { status } }),
  });
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, action: "approve" | "reject") => {
    let note: string | undefined;
    if (action === "reject") {
      note = window.prompt("เหตุผลที่ไม่อนุมัติ (ผู้ใช้จะเห็นข้อความนี้)") ?? undefined;
      if (note === undefined) return;
    }
    setBusy(id);
    try {
      await review({ data: { id, action, ...(note ? { note } : {}) } });
      toast.success(
        action === "approve" ? "อนุมัติแล้ว เปิดใช้งานให้ผู้ใช้เรียบร้อย" : "ปฏิเสธแล้ว",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  if (payments.isLoading)
    return <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />;
  if (payments.error)
    return <p className="mt-6 text-sm text-destructive">{String(payments.error)}</p>;
  if (!payments.data?.length)
    return <p className="mt-6 text-sm text-muted-foreground">ไม่มีรายการ</p>;

  return (
    <ul className="mt-4 grid gap-4 md:grid-cols-2">
      {payments.data.map((payment) => (
        <li key={payment.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
          {payment.slipUrl ? (
            <a href={payment.slipUrl} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={payment.slipUrl} alt="สลิป" className="h-40 w-28 rounded-lg object-cover" />
            </a>
          ) : (
            <div className="h-40 w-28 shrink-0 rounded-lg bg-muted" />
          )}
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <div className="truncate font-semibold">{payment.email}</div>
            <div>
              {PLAN_LABELS[payment.plan]} ·{" "}
              <span className="font-semibold">{formatKip(payment.amountKip)}</span>
            </div>
            {payment.promoCode && (
              <div className="text-xs text-muted-foreground">โค้ด {payment.promoCode}</div>
            )}
            <div className="text-xs text-muted-foreground">
              {new Date(payment.createdAt).toLocaleString("th-TH")}
            </div>
            {payment.paidUntil && (
              <div className="text-xs text-muted-foreground">
                ใช้ได้ถึง {new Date(payment.paidUntil).toLocaleDateString("th-TH")}
              </div>
            )}
            {payment.adminNote && <div className="text-xs">หมายเหตุ: {payment.adminNote}</div>}
            {payment.slipUrl && (
              <a
                href={payment.slipUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary"
              >
                เปิดสลิป <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {status === "pending" && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => void act(payment.id, "approve")}
                  disabled={busy === payment.id}
                >
                  <Check className="mr-1 h-4 w-4" /> อนุมัติ
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void act(payment.id, "reject")}
                  disabled={busy === payment.id}
                >
                  <X className="mr-1 h-4 w-4" /> ไม่อนุมัติ
                </Button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PaymentSettings() {
  const fetchPricing = useServerFn(getPricing);
  const update = useServerFn(adminUpdateSettings);
  const queryClient = useQueryClient();
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing() });
  const [form, setForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    contact: "",
  });
  const [qr, setQr] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const settings = pricing.data?.settings;
    if (!settings) return;
    setForm({
      bankName: settings.bankName ?? "",
      accountName: settings.accountName ?? "",
      accountNumber: settings.accountNumber ?? "",
      contact: settings.contact ?? "",
    });
  }, [pricing.data]);

  const save = async () => {
    if (qr && !["image/png", "image/jpeg", "image/webp"].includes(qr.type)) {
      toast.error("QR ต้องเป็นไฟล์ PNG, JPG หรือ WebP");
      return;
    }
    if (qr && qr.size > 2 * 1024 * 1024) {
      toast.error("ไฟล์ QR ใหญ่เกิน 2MB");
      return;
    }
    setSaving(true);
    try {
      await update({
        data: {
          ...form,
          ...(qr
            ? {
                qrBase64: await fileToBase64(qr),
                qrContentType: qr.type as "image/png" | "image/jpeg" | "image/webp",
              }
            : {}),
        },
      });
      toast.success("บันทึกแล้ว");
      setQr(null);
      await queryClient.invalidateQueries({ queryKey: ["pricing"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <div className="mt-4 grid gap-6 rounded-2xl border border-border bg-card p-5 md:grid-cols-[220px_1fr]">
      <div className="space-y-3">
        {pricing.data?.settings.paymentQrUrl ? (
          <img
            src={pricing.data.settings.paymentQrUrl}
            alt="QR ปัจจุบัน"
            className="w-full rounded-xl bg-white p-2"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
            ยังไม่มี QR
          </div>
        )}
        <Label htmlFor="qr">อัปโหลด QR ใหม่</Label>
        <Input
          id="qr"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setQr(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className="space-y-4">
        {field("bankName", "ธนาคาร")}
        {field("accountName", "ชื่อบัญชี")}
        {field("accountNumber", "เลขบัญชี")}
        {field("contact", "ช่องทางติดต่อ (เช่น WhatsApp / Facebook)")}
        <Button onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}

const EMPTY_PROMO = { code: "", monthly: "", yearly: "", expiresAt: "", maxUses: "", active: true };

function PromoCodes() {
  const list = useServerFn(adminListPromoCodes);
  const save = useServerFn(adminSavePromoCode);
  const queryClient = useQueryClient();
  const codes = useQuery({ queryKey: ["admin-promo"], queryFn: () => list() });
  const [form, setForm] = useState(EMPTY_PROMO);
  const [saving, setSaving] = useState(false);

  const toNumber = (value: string) => (value.trim() ? Number(value.replace(/,/g, "")) : null);

  const submit = async () => {
    setSaving(true);
    try {
      await save({
        data: {
          code: form.code,
          monthlyPriceKip: toNumber(form.monthly),
          yearlyPriceKip: toNumber(form.yearly),
          expiresAt: form.expiresAt || null,
          maxUses: toNumber(form.maxUses),
          active: form.active,
        },
      });
      toast.success("บันทึกโค้ดแล้ว");
      setForm(EMPTY_PROMO);
      await queryClient.invalidateQueries({ queryKey: ["admin-promo"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">โค้ด</th>
              <th className="p-3">รายเดือน</th>
              <th className="p-3">รายปี</th>
              <th className="p-3">หมดอายุ</th>
              <th className="p-3">ใช้แล้ว</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {codes.data?.map((promo) => (
              <tr key={promo.code} className="border-t border-border">
                <td className="p-3 font-semibold">{promo.code}</td>
                <td className="p-3">
                  {promo.monthly_price_kip != null ? formatKip(promo.monthly_price_kip) : "-"}
                </td>
                <td className="p-3">
                  {promo.yearly_price_kip != null ? formatKip(promo.yearly_price_kip) : "-"}
                </td>
                <td className="p-3">
                  {promo.expires_at
                    ? new Date(promo.expires_at).toLocaleDateString("th-TH")
                    : "ไม่มี"}
                </td>
                <td className="p-3">
                  {promo.used_count}
                  {promo.max_uses != null ? ` / ${promo.max_uses}` : ""}
                </td>
                <td className="p-3">{promo.active ? "เปิด" : "ปิด"}</td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        code: promo.code,
                        monthly: promo.monthly_price_kip?.toString() ?? "",
                        yearly: promo.yearly_price_kip?.toString() ?? "",
                        expiresAt: promo.expires_at?.slice(0, 10) ?? "",
                        maxUses: promo.max_uses?.toString() ?? "",
                        active: promo.active,
                      })
                    }
                  >
                    แก้ไข
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="promo-code">โค้ด</Label>
          <Input
            id="promo-code"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-expires">วันหมดอายุ (เว้นว่าง = ไม่มี)</Label>
          <Input
            id="promo-expires"
            type="date"
            value={form.expiresAt}
            onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-monthly">ราคารายเดือนเมื่อใช้โค้ด (KIP)</Label>
          <Input
            id="promo-monthly"
            inputMode="numeric"
            value={form.monthly}
            onChange={(event) => setForm({ ...form, monthly: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-yearly">ราคารายปีเมื่อใช้โค้ด (KIP)</Label>
          <Input
            id="promo-yearly"
            inputMode="numeric"
            value={form.yearly}
            onChange={(event) => setForm({ ...form, yearly: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-max">จำนวนครั้งสูงสุด (เว้นว่าง = ไม่จำกัด)</Label>
          <Input
            id="promo-max"
            inputMode="numeric"
            value={form.maxUses}
            onChange={(event) => setForm({ ...form, maxUses: event.target.value })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="promo-active"
            checked={form.active}
            onCheckedChange={(active) => setForm({ ...form, active })}
          />
          <Label htmlFor="promo-active">เปิดใช้งาน</Label>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => void submit()} disabled={saving || form.code.trim().length < 2}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            บันทึกโค้ด
          </Button>
        </div>
      </div>
    </div>
  );
}
