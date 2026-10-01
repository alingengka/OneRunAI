import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAccount } from "@/lib/account.functions";

/** Supabase session in the browser; `ready` is false until it has been read. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return { session, ready };
}

/** The signed-in user's plan, trial and quota. */
export function useAccount(enabled: boolean) {
  const fetchAccount = useServerFn(getAccount);
  return useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
    enabled,
    staleTime: 30_000,
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await supabase.auth.signOut();
    queryClient.removeQueries({ queryKey: ["account"] });
    window.location.href = "/";
  };
}
