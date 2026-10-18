/**
 * พร็อกซีอ่านไฟล์สื่อ B-roll ให้เป็น origin เดียวกับแอป
 * จำเป็นเพราะ canvas ที่วาดภาพข้ามโดเมนจะถูก "taint" แล้ว export ไม่ได้
 * อนุญาตเฉพาะโฮสต์ของ KLIPY, Pixabay และคลังไฟล์ของโปรเจกต์เท่านั้น
 */
import { createFileRoute } from "@tanstack/react-router";

function allowedHost(host: string): boolean {
  if (host === "klipy.com" || host.endsWith(".klipy.com")) return true;
  if (host === "pixabay.com" || host.endsWith(".pixabay.com")) return true;
  const storage = process.env["SUPABASE_URL"];
  if (storage) {
    try {
      if (host === new URL(storage).hostname) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export const Route = createFileRoute("/api/public/broll-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!target) return new Response("missing url", { status: 400 });
        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("bad url", { status: 400 });
        }
        if (parsed.protocol !== "https:" || !allowedHost(parsed.hostname)) {
          return new Response("host not allowed", { status: 403 });
        }
        // Redirects are followed by hand so they cannot lead off the allowed hosts.
        let upstream: Response | null = null;
        let next = parsed;
        try {
          for (let hop = 0; hop < 4; hop++) {
            const response = await fetch(next.toString(), {
              redirect: "manual",
              headers: request.headers.has("range") ? { range: request.headers.get("range")! } : {},
            });
            const location = response.headers.get("location");
            if (response.status >= 300 && response.status < 400 && location) {
              next = new URL(location, next);
              if (next.protocol !== "https:" || !allowedHost(next.hostname)) {
                return new Response("host not allowed", { status: 403 });
              }
              continue;
            }
            upstream = response;
            break;
          }
        } catch {
          return new Response("upstream unreachable", { status: 502 });
        }
        if (!upstream) return new Response("too many redirects", { status: 502 });
        if (!upstream.ok && upstream.status !== 206) {
          return new Response(`upstream error ${upstream.status}`, { status: upstream.status });
        }
        // Media only: the proxy must not serve pages or scripts from our domain.
        const type = upstream.headers.get("content-type") ?? "";
        if (!/^(image|video|audio)\/|^application\/octet-stream/i.test(type)) {
          return new Response("not a media file", { status: 415 });
        }
        const headers = new Headers();
        const copy = ["content-type", "content-length", "content-range", "accept-ranges"];
        headers.set("x-content-type-options", "nosniff");
        for (const key of copy) {
          const value = upstream.headers.get(key);
          if (value) headers.set(key, value);
        }
        headers.set("cache-control", "public, max-age=3600");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
