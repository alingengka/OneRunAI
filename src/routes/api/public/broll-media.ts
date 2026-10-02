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
        let upstream: Response;
        try {
          upstream = await fetch(parsed.toString(), {
            headers: request.headers.has("range") ? { range: request.headers.get("range")! } : {},
          });
        } catch {
          return new Response("upstream unreachable", { status: 502 });
        }
        if (!upstream.ok && upstream.status !== 206) {
          return new Response(`upstream error ${upstream.status}`, { status: upstream.status });
        }
        const headers = new Headers();
        const copy = ["content-type", "content-length", "content-range", "accept-ranges"];
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
