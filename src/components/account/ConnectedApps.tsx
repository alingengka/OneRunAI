/**
 * Apps (Claude) the customer allowed to use their OneRun account through the
 * connector, with a button to disconnect. Shows nothing when there are none.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Grant = { clientId: string; name: string; grantedAt: string };

export function ConnectedApps() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.oauth
      .listGrants()
      .then(({ data }) => {
        if (!alive || !data) return;
        setGrants(
          data.map((grant) => ({
            clientId: grant.client.id,
            name: grant.client.name || "แอปที่ไม่ระบุชื่อ",
            grantedAt: grant.granted_at,
          })),
        );
      })
      // the OAuth server is off, or an older session: nothing to show
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!grants.length) return null;

  const revoke = async (grant: Grant) => {
    setBusy(grant.clientId);
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId: grant.clientId });
    setBusy(null);
    if (error) {
      toast.error("ยกเลิกการเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
      return;
    }
    setGrants((all) => all.filter((g) => g.clientId !== grant.clientId));
    toast.success(`ยกเลิกการเชื่อมต่อ ${grant.name} แล้ว`);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">แอปที่เชื่อมต่อ</h2>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {grants.map((grant) => (
          <li key={grant.clientId} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div>
              <div className="font-medium">{grant.name}</div>
              <div className="text-xs text-muted-foreground">
                อนุญาตเมื่อ {new Date(grant.grantedAt).toLocaleString("th-TH")}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy === grant.clientId}
              onClick={() => void revoke(grant)}
            >
              {busy === grant.clientId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ยกเลิกการเชื่อมต่อ
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
