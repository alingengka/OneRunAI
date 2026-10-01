/** Account helpers safe to import from client code. */

export const ACCOUNT_ERROR_CODES = ["ACCESS_EXPIRED", "QUOTA_EXCEEDED", "Unauthorized"] as const;

/** True for errors that retrying cannot fix (no access, no quota, signed out). */
export function isAccountError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return ACCOUNT_ERROR_CODES.some((code) => message.includes(code));
}

export function formatKip(amount: number): string {
  return `${amount.toLocaleString("en-US")} KIP`;
}

export function formatMinutes(seconds: number): string {
  return `${Math.max(0, Math.floor(seconds / 60)).toLocaleString("en-US")} นาที`;
}

export function daysLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
}

export const PLAN_LABELS: Record<string, string> = {
  trial: "ทดลองใช้ฟรี",
  monthly: "รายเดือน",
  yearly: "รายปี",
};
