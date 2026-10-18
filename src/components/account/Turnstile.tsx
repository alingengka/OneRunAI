import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Cloudflare Turnstile (CAPTCHA) for the sign-in, sign-up and reset forms.
 * Supabase checks the token once CAPTCHA protection is switched on there;
 * until then the token is simply ignored, so this can ship first.
 */
const SITE_KEY = "0x4AAAAAAFadX1FrsMKem3K-";
/** Cloudflare's always-pass test key: the real key only works on onerunai.com. */
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme?: "auto" | "light" | "dark";
      language?: string;
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi | null> | null = null;
function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      scriptPromise = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

const siteKey = () =>
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? TEST_SITE_KEY : SITE_KEY;

export type TurnstileHandle = {
  /**
   * A fresh token for one auth request (each token works once), waiting a
   * moment for the check to finish. Undefined when the check could not run.
   */
  token: () => Promise<string | undefined>;
};

export const Turnstile = forwardRef<TurnstileHandle, { className?: string }>(function Turnstile(
  { className },
  ref,
) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    api: TurnstileApi | null;
    id: string | null;
    token: string | null;
    failed: boolean;
    waiters: ((token: string | undefined) => void)[];
  }>({ api: null, id: null, token: null, failed: false, waiters: [] });

  useEffect(() => {
    let cancelled = false;
    const state = stateRef.current;
    const settle = (token: string | undefined) => {
      for (const resolve of state.waiters.splice(0)) resolve(token);
    };
    void loadTurnstile().then((api) => {
      if (cancelled || !boxRef.current) return;
      if (!api) {
        state.failed = true;
        settle(undefined);
        return;
      }
      state.api = api;
      state.id = api.render(boxRef.current, {
        sitekey: siteKey(),
        theme: "auto",
        language: "th",
        callback: (token) => {
          state.token = token;
          state.failed = false;
          settle(token);
        },
        "expired-callback": () => {
          state.token = null;
        },
        "error-callback": () => {
          state.failed = true;
          settle(undefined);
        },
      });
    });
    return () => {
      cancelled = true;
      if (state.api && state.id) state.api.remove(state.id);
      state.id = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    token: async () => {
      const state = stateRef.current;
      let token: string | undefined = state.token ?? undefined;
      if (!token && !state.failed) {
        token = await new Promise<string | undefined>((resolve) => {
          state.waiters.push(resolve);
          window.setTimeout(() => resolve(undefined), 20_000);
        });
      }
      // used up: start a new check for the next request
      state.token = null;
      if (state.api && state.id) {
        state.failed = false;
        state.api.reset(state.id);
      }
      return token;
    },
  }));

  return <div ref={boxRef} className={className} />;
});
