import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-only modules are loaded inside handlers: this file ships to the client.
const server = () => import("./account.server");
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const SLIP_BUCKET = "payment-slips";
const SITE_BUCKET = "site-assets";

export type PaidPlanId = "monthly" | "yearly";

export type Pricing = {
  plans: {
    id: PaidPlanId;
    name: string;
    priceKip: number;
    durationDays: number;
    quotaSeconds: number;
  }[];
  trial: { durationDays: number; quotaSeconds: number };
  settings: {
    paymentQrUrl: string | null;
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    contact: string | null;
  };
};

export const getPricing = createServerFn({ method: "GET" }).handler(async (): Promise<Pricing> => {
  const db = await admin();
  const [{ data: plans, error }, { data: settings }] = await Promise.all([
    db.from("plans").select("*").eq("active", true).order("sort_order"),
    db.from("app_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (error) throw new Error(`อ่านแพ็กเกจไม่สำเร็จ: ${error.message}`);
  const trial = plans?.find((plan) => plan.id === "trial");
  return {
    plans: (plans ?? [])
      .filter((plan) => plan.id === "monthly" || plan.id === "yearly")
      .map((plan) => ({
        id: plan.id as PaidPlanId,
        name: plan.name,
        priceKip: plan.price_kip,
        durationDays: plan.duration_days,
        quotaSeconds: plan.quota_seconds,
      })),
    trial: { durationDays: trial?.duration_days ?? 5, quotaSeconds: trial?.quota_seconds ?? 1800 },
    settings: {
      paymentQrUrl: settings?.payment_qr_url ?? null,
      bankName: settings?.bank_name ?? null,
      accountName: settings?.account_name ?? null,
      accountNumber: settings?.account_number ?? null,
      contact: settings?.contact ?? null,
    },
  };
});

export type AccountInfo = Awaited<ReturnType<typeof loadAccount>>;

async function loadAccount(userId: string) {
  const db = await admin();
  const { getAccountStatus } = await server();
  const [status, { data: profile }, { data: payments }] = await Promise.all([
    getAccountStatus(userId),
    db
      .from("profiles")
      .select("email, is_admin, trial_ends_at, paid_until")
      .eq("id", userId)
      .maybeSingle(),
    db
      .from("payments")
      .select("id, plan, amount_kip, status, admin_note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return {
    ...status,
    email: profile?.email ?? null,
    isAdmin: !!profile?.is_admin,
    trialEndsAt: profile?.trial_ends_at ?? null,
    paidUntil: profile?.paid_until ?? null,
    payments: (payments ?? []).map((payment) => ({
      id: payment.id,
      plan: payment.plan,
      amountKip: payment.amount_kip,
      status: payment.status as "pending" | "approved" | "rejected",
      adminNote: payment.admin_note,
      createdAt: payment.created_at,
    })),
  };
}

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadAccount(context.userId));

/** Price for a plan, applying a promo code when it is valid. */
async function quote(plan: PaidPlanId, rawCode: string | undefined) {
  const db = await admin();
  const { data: planRow } = await db
    .from("plans")
    .select("price_kip, active")
    .eq("id", plan)
    .maybeSingle();
  if (!planRow?.active) throw new Error("ไม่พบแพ็กเกจนี้");
  const code = rawCode?.trim().toUpperCase();
  if (!code)
    return {
      amountKip: planRow.price_kip,
      regularKip: planRow.price_kip,
      code: null,
      message: null,
    };

  const { data: promo } = await db.from("promo_codes").select("*").eq("code", code).maybeSingle();
  const price = promo
    ? plan === "monthly"
      ? promo.monthly_price_kip
      : promo.yearly_price_kip
    : null;
  let message: string | null = null;
  if (!promo || !promo.active) message = "ไม่พบโค้ดส่วนลดนี้";
  else if (promo.expires_at && new Date(promo.expires_at) < new Date())
    message = "โค้ดส่วนลดนี้หมดอายุแล้ว";
  else if (promo.max_uses != null && promo.used_count >= promo.max_uses)
    message = "โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว";
  else if (price == null) message = "โค้ดนี้ใช้กับแพ็กเกจนี้ไม่ได้";
  if (message || price == null)
    return { amountKip: planRow.price_kip, regularKip: planRow.price_kip, code: null, message };
  return { amountKip: price, regularKip: planRow.price_kip, code, message: null };
}

const planInput = z.enum(["monthly", "yearly"]);

export const quotePrice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ plan: planInput, code: z.string().max(40).optional() }).parse(data),
  )
  .handler(async ({ data }) => quote(data.plan, data.code));

export const submitPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        plan: planInput,
        code: z.string().max(40).optional(),
        slipPath: z.string().min(3).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Slips live in the payer's own folder; anything else is rejected.
    if (!data.slipPath.startsWith(`${context.userId}/`) || data.slipPath.includes("..")) {
      throw new Error("ไฟล์สลิปไม่ถูกต้อง");
    }
    const db = await admin();
    const { count } = await db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if ((count ?? 0) >= 3) throw new Error("คุณมีสลิปที่รอตรวจอยู่แล้ว กรุณารอผู้ดูแลตรวจสอบ");

    const price = await quote(data.plan, data.code);
    if (data.code?.trim() && price.message) throw new Error(price.message);
    const { error } = await db.from("payments").insert({
      user_id: context.userId,
      plan: data.plan,
      promo_code: price.code,
      amount_kip: price.amountKip,
      slip_path: data.slipPath,
    });
    if (error) throw new Error(`ส่งสลิปไม่สำเร็จ: ${error.message}`);
    return { ok: true, amountKip: price.amountKip };
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await server();
    await assertAdmin(context.userId);
    const db = await admin();
    const { data: rows, error } = await db
      .from("payments")
      .select("*")
      .eq("status", data.status)
      .order("created_at", { ascending: data.status === "pending" })
      .limit(100);
    if (error) throw new Error(error.message);
    const userIds = [...new Set((rows ?? []).map((row) => row.user_id))];
    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id, email, paid_until").in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return Promise.all(
      (rows ?? []).map(async (row) => {
        const signed = await db.storage.from(SLIP_BUCKET).createSignedUrl(row.slip_path, 60 * 60);
        return {
          id: row.id,
          email: byId.get(row.user_id)?.email ?? row.user_id,
          paidUntil: byId.get(row.user_id)?.paid_until ?? null,
          plan: row.plan,
          promoCode: row.promo_code,
          amountKip: row.amount_kip,
          status: row.status,
          adminNote: row.admin_note,
          createdAt: row.created_at,
          slipUrl: signed.data?.signedUrl ?? null,
        };
      }),
    );
  });

export const adminReviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await server();
    await assertAdmin(context.userId);
    const db = await admin();
    if (data.action === "approve") {
      const { error } = await db.rpc("approve_payment", {
        payment_id: data.id,
        admin_id: context.userId,
      });
      if (error) throw new Error(`อนุมัติไม่สำเร็จ: ${error.message}`);
    } else {
      const { error } = await db
        .from("payments")
        .update({
          status: "rejected",
          admin_note: data.note?.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: context.userId,
        })
        .eq("id", data.id)
        .eq("status", "pending");
      if (error) throw new Error(`ปฏิเสธไม่สำเร็จ: ${error.message}`);
    }
    return { ok: true };
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bankName: z.string().max(120),
        accountName: z.string().max(120),
        accountNumber: z.string().max(60),
        contact: z.string().max(200),
        // Optional new QR image, base64 without the data: prefix.
        qrBase64: z.string().max(3_000_000).optional(),
        qrContentType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await server();
    await assertAdmin(context.userId);
    const db = await admin();
    let paymentQrUrl: string | undefined;
    if (data.qrBase64 && data.qrContentType) {
      const bytes = Uint8Array.from(atob(data.qrBase64), (c) => c.charCodeAt(0));
      const ext = data.qrContentType.split("/")[1];
      const path = `payment-qr-${Date.now()}.${ext}`;
      const { error } = await db.storage
        .from(SITE_BUCKET)
        .upload(path, bytes, { contentType: data.qrContentType, upsert: true });
      if (error) throw new Error(`อัปโหลด QR ไม่สำเร็จ: ${error.message}`);
      paymentQrUrl = db.storage.from(SITE_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const { error } = await db
      .from("app_settings")
      .update({
        bank_name: data.bankName.trim() || null,
        account_name: data.accountName.trim() || null,
        account_number: data.accountNumber.trim() || null,
        contact: data.contact.trim() || null,
        ...(paymentQrUrl ? { payment_qr_url: paymentQrUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);
    return { ok: true };
  });

export const adminListPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await server();
    await assertAdmin(context.userId);
    const db = await admin();
    const { data, error } = await db.from("promo_codes").select("*").order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSavePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/),
        monthlyPriceKip: z.number().int().min(0).nullable(),
        yearlyPriceKip: z.number().int().min(0).nullable(),
        expiresAt: z.string().nullable(),
        maxUses: z.number().int().min(1).nullable(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await server();
    await assertAdmin(context.userId);
    const db = await admin();
    const { error } = await db.from("promo_codes").upsert({
      code: data.code.toUpperCase(),
      monthly_price_kip: data.monthlyPriceKip,
      yearly_price_kip: data.yearlyPriceKip,
      expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      max_uses: data.maxUses,
      active: data.active,
    });
    if (error) throw new Error(`บันทึกโค้ดไม่สำเร็จ: ${error.message}`);
    return { ok: true };
  });
