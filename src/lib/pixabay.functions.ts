import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapPixabayHits, type PixabayItem } from "./pixabay";

export type { PixabayItem };

/**
 * Free stock videos and photos from Pixabay (commercial use allowed, no
 * attribution required). Needs PIXABAY_API_KEY. Pixabay asks apps not to
 * hotlink its files permanently, so a picked file is copied into the
 * project's own storage before it is used (see BrollPicker).
 */
const PIXABAY_API = "https://pixabay.com/api";

/** Pixabay search understands these languages; Lao queries fall back to English. */
const PIXABAY_LANGS = new Set(["en", "th", "vi", "id", "ja", "ko", "zh", "fr", "de", "es"]);

export const searchPixabayMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(1).max(100),
        kind: z.enum(["videos", "images"]).default("videos"),
        lang: z.string().max(5).optional(),
        page: z.number().int().min(1).max(20).default(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ items: PixabayItem[]; total: number }> => {
    const { assertAccess } = await import("./account.server");
    await assertAccess(context.userId);
    const key = process.env["PIXABAY_API_KEY"];
    if (!key) throw new Error("ยังไม่ได้เชื่อมต่อคลัง Pixabay (ใส่ PIXABAY_API_KEY ใน Vercel)");

    const params = new URLSearchParams({
      key,
      q: data.query,
      per_page: "24",
      page: String(data.page),
      safesearch: "true",
      lang: data.lang && PIXABAY_LANGS.has(data.lang) ? data.lang : "en",
    });
    if (data.kind === "images") {
      params.set("image_type", "photo");
    }
    const url = `${PIXABAY_API}/${data.kind === "videos" ? "videos/" : ""}?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`Pixabay search failed [${response.status}]: ${body.slice(0, 200)}`);
      throw new Error(
        response.status === 429
          ? "ค้นหาถี่เกินไป รอสักครู่แล้วลองใหม่"
          : `ค้นหาคลิปไม่สำเร็จ [${response.status}]`,
      );
    }
    const payload = (await response.json()) as { totalHits?: number; hits?: unknown[] };
    const items = mapPixabayHits(data.kind, payload.hits ?? []);
    return { items, total: payload.totalHits ?? items.length };
  });

/** English stock-footage search terms for a caption line (any language). */
export const suggestBrollKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ text: z.string().trim().min(1).max(600) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ keywords: string[] }> => {
    const { assertAccess } = await import("./account.server");
    await assertAccess(context.userId);
    const { GEMINI_TRANSLATE_MODEL, geminiChat } = await import("./ai-providers.server");
    const content = await geminiChat(
      GEMINI_TRANSLATE_MODEL,
      [
        {
          role: "user",
          content: [
            "Suggest 5 short English search terms for stock video B-roll that illustrates this spoken line.",
            "Each term is 1-3 concrete visual words (e.g. 'coffee shop', 'city night traffic').",
            "Return only the terms, one per line, no numbering or quotes.",
            `Line: ${data.text}`,
          ].join("\n"),
        },
      ],
      "B-roll keywords",
      { temperature: 0.4 },
    );
    const keywords = content
      .split(/\n|,/)
      .map((term) => term.replace(/^[\s\-*\d.)"']+|["']+$/g, "").trim())
      .filter((term) => term && term.length <= 40)
      .slice(0, 5);
    return { keywords };
  });
