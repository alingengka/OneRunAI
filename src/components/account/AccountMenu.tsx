import { Link } from "@tanstack/react-router";
import { CreditCard, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { daysLeft, formatMinutes, PLAN_LABELS } from "@/lib/account-shared";
import { useAccount, useSession, useSignOut } from "@/lib/auth";

export function AccountMenu() {
  const { session } = useSession();
  const { data } = useAccount(!!session);
  const signOut = useSignOut();
  if (!data) return null;

  const remaining = data.quotaSeconds - data.usedSeconds;
  const summary =
    data.status === "trial"
      ? `ทดลองฟรี เหลือ ${daysLeft(data.endsAt)} วัน`
      : (PLAN_LABELS[data.plan ?? ""] ?? "แพ็กเกจ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="gap-2" aria-label="บัญชีของฉัน">
          <UserRound className="h-4 w-4" />
          <span className="hidden text-xs lg:inline">{summary}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <div className="truncate text-sm">{data.email}</div>
          <div className="text-xs font-normal text-muted-foreground">{summary}</div>
          <div className="text-xs font-normal text-muted-foreground">
            AI คงเหลือ {formatMinutes(remaining)} จาก {formatMinutes(data.quotaSeconds)}
            {data.status === "paid" ? " (เดือนนี้)" : ""}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/billing">
            <CreditCard className="mr-2 h-4 w-4" /> แพ็กเกจและการชำระเงิน
          </Link>
        </DropdownMenuItem>
        {data.isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <ShieldCheck className="mr-2 h-4 w-4" /> ผู้ดูแลระบบ
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
