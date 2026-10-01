import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatKip, PLAN_LABELS } from "@/lib/account-shared";
import { adminUsageSummary, type UsageSummary as Summary } from "@/lib/usage.functions";

type Days = 7 | 30 | 90;

const COST_KEY = "onerun-admin-cost-per-minute";
// Rough blended AI cost per audio minute (ElevenLabs + Gemini + 2× OpenAI).
const DEFAULT_COST_PER_MINUTE = 0.03;

const STATUS_LABELS: Record<Summary["users"][number]["status"], string> = {
  paid: "จ่ายแล้ว",
  trial: "ทดลองใช้",
  expired: "หมดอายุ",
};

function readCost(): number {
  try {
    const value = Number(window.localStorage.getItem(COST_KEY));
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_COST_PER_MINUTE;
  } catch {
    return DEFAULT_COST_PER_MINUTE;
  }
}

function minutes(seconds: number): number {
  return seconds / 60;
}

function formatMinutes(seconds: number): string {
  const value = minutes(seconds);
  return `${value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString("en-US")} นาที`;
}

function formatUsd(value: number): string {
  return `$${value < 10 ? value.toFixed(2) : Math.round(value).toLocaleString("en-US")}`;
}

function shortDate(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)}/${Number(month)}`;
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Single-series daily bar chart: AI minutes per day. */
export function DailyChart({ daily }: { daily: Summary["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...daily.map((day) => day.seconds), 60);
  // Round the axis top to a friendly number of minutes.
  const topMinutes = (() => {
    const raw = minutes(max);
    const step = raw <= 10 ? 2 : raw <= 50 ? 10 : raw <= 250 ? 50 : 100;
    return Math.ceil(raw / step) * step;
  })();
  const ticks = [0, 0.5, 1].map((fraction) => Math.round(topMinutes * fraction));
  const labelEvery = daily.length > 31 ? 14 : daily.length > 7 ? 5 : 1;
  const hovered = hover !== null ? daily[hover] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">การใช้ AI ถอดเสียงรายวัน (นาที)</h3>
        <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {hovered ? `${shortDate(hovered.date)} · ${formatMinutes(hovered.seconds)}` : " "}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="flex h-40 w-8 shrink-0 flex-col justify-between text-right text-[10px] text-muted-foreground tabular-nums">
          {[...ticks].reverse().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="relative h-40 flex-1">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-border/60"
              style={{ bottom: `${(tick / topMinutes) * 100}%` }}
            />
          ))}
          <div
            className="absolute inset-0 flex items-end gap-[2px]"
            onMouseLeave={() => setHover(null)}
          >
            {daily.map((day, index) => {
              const height = (minutes(day.seconds) / topMinutes) * 100;
              return (
                <button
                  key={day.date}
                  type="button"
                  className="group flex h-full flex-1 items-end focus:outline-none"
                  onMouseEnter={() => setHover(index)}
                  onFocus={() => setHover(index)}
                  aria-label={`${day.date}: ${formatMinutes(day.seconds)}`}
                >
                  <span
                    className={cn(
                      "block w-full rounded-t-[4px] bg-primary transition-opacity",
                      hover !== null && hover !== index && "opacity-40",
                    )}
                    style={{ height: day.seconds > 0 ? `max(${height}%, 2px)` : "0" }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-1 flex gap-[2px] pl-10 text-[10px] text-muted-foreground">
        {daily.map((day, index) => (
          <span key={day.date} className="flex-1 text-center tabular-nums">
            {index % labelEvery === 0 || index === daily.length - 1 ? shortDate(day.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UsageSummary() {
  const fetchSummary = useServerFn(adminUsageSummary);
  const [days, setDays] = useState<Days>(30);
  const [cost, setCost] = useState<number>(() =>
    typeof window === "undefined" ? DEFAULT_COST_PER_MINUTE : readCost(),
  );
  const [filter, setFilter] = useState<"all" | "active" | Summary["users"][number]["status"]>(
    "active",
  );
  const [search, setSearch] = useState("");
  const summary = useQuery({
    queryKey: ["admin-usage", days],
    queryFn: () => fetchSummary({ data: { days } }),
  });

  const updateCost = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setCost(parsed);
    try {
      window.localStorage.setItem(COST_KEY, String(parsed));
    } catch {
      /* preference only */
    }
  };

  const users = useMemo(() => {
    const rows = summary.data?.users ?? [];
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !row.email.toLowerCase().includes(query)) return false;
      if (filter === "active") return row.seconds > 0;
      if (filter === "all") return true;
      return row.status === filter;
    });
  }, [summary.data, filter, search]);

  const data = summary.data;
  const totalCost = data ? minutes(data.totalSeconds) * cost : 0;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div
          className="flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label="ช่วงเวลา"
        >
          {([7, 30, 90] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                days === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value} วัน
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cost-per-minute" className="text-xs text-muted-foreground">
            ต้นทุน AI ต่อนาที (USD)
          </Label>
          <Input
            id="cost-per-minute"
            type="number"
            min="0.001"
            step="0.005"
            defaultValue={cost}
            onChange={(event) => updateCost(event.target.value)}
            className="h-9 w-28"
          />
        </div>
      </div>

      {summary.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {summary.error && (
        <p className="text-sm text-destructive">
          {summary.error instanceof Error ? summary.error.message : "โหลดข้อมูลไม่สำเร็จ"}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={`ใช้ AI ไปทั้งหมด (${days} วัน)`}
              value={formatMinutes(data.totalSeconds)}
              hint={`ต้นทุนประมาณ ${formatUsd(totalCost)}`}
            />
            <StatTile
              label="ผู้ใช้ที่ใช้งาน AI"
              value={data.activeUsers.toLocaleString("en-US")}
              hint={
                data.activeUsers
                  ? `เฉลี่ย ${formatMinutes(data.totalSeconds / data.activeUsers)} / คน`
                  : "ยังไม่มีการใช้งาน"
              }
            />
            <StatTile
              label={`รายได้ที่อนุมัติ (${days} วัน)`}
              value={formatKip(data.revenueKip)}
              hint={`${data.approvedPayments} รายการ`}
            />
            <StatTile
              label="บัญชีทั้งหมด"
              value={data.accounts.total.toLocaleString("en-US")}
              hint={`จ่ายแล้ว ${data.accounts.paid} · ทดลอง ${data.accounts.trial} · หมดอายุ ${data.accounts.expired} · ใหม่ ${data.newUsers}`}
            />
          </div>

          <DailyChart daily={data.daily} />

          {data.truncated && (
            <p className="text-xs text-muted-foreground">
              แสดงข้อมูลบางส่วน (ข้อมูลมากเกินกว่าจะสรุปในครั้งเดียว) ลองเลือกช่วงเวลาที่สั้นลง
            </p>
          )}

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <h3 className="mr-auto text-sm font-semibold">การใช้งานรายคน</h3>
              <Input
                placeholder="ค้นหาอีเมล"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-8 w-44"
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="กรองผู้ใช้"
              >
                <option value="active">ใช้ AI ในช่วงนี้</option>
                <option value="all">ทั้งหมด</option>
                <option value="paid">จ่ายแล้ว</option>
                <option value="trial">ทดลองใช้</option>
                <option value="expired">หมดอายุ</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">อีเมล</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3 text-right">ใช้ AI</th>
                    <th className="p-3 text-right">ต้นทุนประมาณ</th>
                    <th className="p-3 text-right">จำนวนครั้ง</th>
                    <th className="p-3">ใช้ล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="max-w-[220px] truncate p-3">{row.email}</td>
                      <td className="p-3 whitespace-nowrap">
                        {STATUS_LABELS[row.status]}
                        {row.status === "paid" && row.plan
                          ? ` · ${PLAN_LABELS[row.plan] ?? row.plan}`
                          : ""}
                      </td>
                      <td className="p-3 text-right tabular-nums">{formatMinutes(row.seconds)}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatUsd(minutes(row.seconds) * cost)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {row.requests.toLocaleString("en-US")}
                      </td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString("th-TH") : "-"}
                      </td>
                    </tr>
                  ))}
                  {!users.length && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
