import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AccountStatus = {
  status: "paid" | "trial" | "expired";
  plan: string | null;
  endsAt: string | null;
  quotaSeconds: number;
  usedSeconds: number;
};

/** Error codes the client matches on (see isAccountError in account-shared.ts). */
const MESSAGES: Record<string, string> = {
  ACCESS_EXPIRED:
    'ช่วงทดลองใช้หรือแพ็กเกจของคุณหมดอายุแล้ว กรุณาต่ออายุที่หน้า "แพ็กเกจ" (ACCESS_EXPIRED)',
  QUOTA_EXCEEDED: "โควตาการใช้ AI ของคุณหมดแล้ว กรุณาอัปเกรดหรือรอรอบเดือนใหม่ (QUOTA_EXCEEDED)",
};

function accountError(code: string): Error {
  return new Error(MESSAGES[code] ?? code);
}

export async function getAccountStatus(userId: string): Promise<AccountStatus> {
  const { data, error } = await supabaseAdmin.rpc("account_status", { uid: userId });
  if (error) throw new Error(`อ่านสถานะบัญชีไม่สำเร็จ: ${error.message}`);
  const row = data?.[0];
  return {
    status: (row?.status as AccountStatus["status"]) ?? "expired",
    plan: row?.plan ?? null,
    endsAt: row?.ends_at ?? null,
    quotaSeconds: Number(row?.quota_seconds ?? 0),
    usedSeconds: Number(row?.used_seconds ?? 0),
  };
}

/** Throws unless the trial or subscription is active. */
export async function assertAccess(userId: string): Promise<void> {
  const status = await getAccountStatus(userId);
  if (status.status === "expired") throw accountError("ACCESS_EXPIRED");
}

/**
 * Reserve AI seconds before calling a paid provider. Returns a refund function
 * to call if the provider request fails.
 */
export async function reserveAiSeconds(
  userId: string,
  seconds: number,
  kind: string,
): Promise<() => Promise<void>> {
  const { data, error } = await supabaseAdmin.rpc("consume_ai_seconds", {
    uid: userId,
    secs: Math.round(seconds * 100) / 100,
    usage_kind: kind,
  });
  if (error) {
    const code = Object.keys(MESSAGES).find((key) => error.message.includes(key));
    if (code) throw accountError(code);
    throw new Error(`ตรวจโควตาไม่สำเร็จ: ${error.message}`);
  }
  const usageId = data;
  return async () => {
    await supabaseAdmin.from("usage_events").delete().eq("id", usageId);
  };
}

export async function assertAdmin(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_admin) throw new Error("ต้องเป็นผู้ดูแลระบบ");
}

export { wavSecondsFromBase64 } from "./wav-billing";
