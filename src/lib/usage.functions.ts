import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE = 1000;
// Upper bound on rows pulled per summary; plenty for the early stage, and
// keeps one request from scanning an unbounded table.
const MAX_ROWS = 50_000;
const TIME_ZONE = "Asia/Vientiane";

export type UsageUserRow = {
  id: string;
  email: string;
  status: "paid" | "trial" | "expired";
  plan: string | null;
  seconds: number;
  requests: number;
  lastUsedAt: string | null;
  joinedAt: string;
};

export type UsageSummary = {
  days: number;
  since: string;
  totalSeconds: number;
  activeUsers: number;
  newUsers: number;
  revenueKip: number;
  approvedPayments: number;
  accounts: { trial: number; paid: number; expired: number; total: number };
  daily: { date: string; seconds: number }[];
  users: UsageUserRow[];
  truncated: boolean;
};

/** yyyy-mm-dd in Vientiane time. */
function localDay(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

export const adminUsageSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<UsageSummary> => {
    const { assertAdmin } = await import("./account.server");
    await assertAdmin(context.userId);
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    const now = new Date();
    const since = new Date(now.getTime() - data.days * 86_400_000);
    const sinceIso = since.toISOString();

    // Usage rows in the period (refunds are deleted, so every row counts).
    const usage: { user_id: string; seconds: number; created_at: string }[] = [];
    let truncated = false;
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await db
        .from("usage_events")
        .select("user_id, seconds, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`อ่านข้อมูลการใช้งานไม่สำเร็จ: ${error.message}`);
      usage.push(...(rows ?? []));
      if (!rows || rows.length < PAGE) break;
      if (usage.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
    }

    const profiles: {
      id: string;
      email: string | null;
      trial_ends_at: string;
      paid_until: string | null;
      plan: string | null;
      created_at: string;
    }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await db
        .from("profiles")
        .select("id, email, trial_ends_at, paid_until, plan, created_at")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`อ่านข้อมูลผู้ใช้ไม่สำเร็จ: ${error.message}`);
      profiles.push(...(rows ?? []));
      if (!rows || rows.length < PAGE || profiles.length >= MAX_ROWS) break;
    }

    const { data: payments } = await db
      .from("payments")
      .select("amount_kip")
      .eq("status", "approved")
      .gte("reviewed_at", sinceIso);

    const statusOf = (profile: (typeof profiles)[number]): UsageUserRow["status"] => {
      if (profile.paid_until && new Date(profile.paid_until) > now) return "paid";
      if (new Date(profile.trial_ends_at) > now) return "trial";
      return "expired";
    };

    const perUser = new Map<string, { seconds: number; requests: number; last: string }>();
    const perDay = new Map<string, number>();
    let totalSeconds = 0;
    for (const row of usage) {
      const seconds = Number(row.seconds) || 0;
      totalSeconds += seconds;
      const entry = perUser.get(row.user_id) ?? { seconds: 0, requests: 0, last: row.created_at };
      entry.seconds += seconds;
      entry.requests += 1;
      if (row.created_at > entry.last) entry.last = row.created_at;
      perUser.set(row.user_id, entry);
      const day = localDay(row.created_at);
      perDay.set(day, (perDay.get(day) ?? 0) + seconds);
    }

    // Every day in the window, including days with no usage.
    const daily: UsageSummary["daily"] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const day = localDay(new Date(now.getTime() - i * 86_400_000));
      if (!daily.some((entry) => entry.date === day)) {
        daily.push({ date: day, seconds: perDay.get(day) ?? 0 });
      }
    }

    const accounts = { trial: 0, paid: 0, expired: 0, total: profiles.length };
    const users: UsageUserRow[] = profiles.map((profile) => {
      const status = statusOf(profile);
      accounts[status] += 1;
      const entry = perUser.get(profile.id);
      return {
        id: profile.id,
        email: profile.email ?? profile.id,
        status,
        plan: profile.plan,
        seconds: entry?.seconds ?? 0,
        requests: entry?.requests ?? 0,
        lastUsedAt: entry?.last ?? null,
        joinedAt: profile.created_at,
      };
    });
    users.sort((a, b) => b.seconds - a.seconds || b.joinedAt.localeCompare(a.joinedAt));

    return {
      days: data.days,
      since: sinceIso,
      totalSeconds,
      activeUsers: perUser.size,
      newUsers: profiles.filter((profile) => profile.created_at >= sinceIso).length,
      revenueKip: (payments ?? []).reduce((sum, payment) => sum + payment.amount_kip, 0),
      approvedPayments: payments?.length ?? 0,
      accounts,
      daily,
      users,
      truncated,
    };
  });
