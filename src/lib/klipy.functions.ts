import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/klipy";

export type KlipyItem = {
  id: string;
  title: string;
  /** ภาพ/GIF สำหรับโชว์ในกริดและพรีวิว */
  previewUrl: string;
  /** ไฟล์ที่ใช้จริง (mp4 ถ้ามี ไม่งั้นเป็น gif) */
  assetUrl: string;
  assetType: "image" | "video";
};

type FileVariant = { url?: string; width?: number; height?: number };
type FileEntry = Record<string, FileVariant | undefined>;
type KlipyRaw = {
  id?: string | number;
  slug?: string;
  title?: string;
  file?: Record<string, FileEntry | undefined>;
};

/** ไล่หา url ของฟอร์แมตที่ต้องการ จากขนาดที่ใหญ่พอแต่ไม่หนักเกิน */
function pickUrl(file: KlipyRaw["file"], formats: string[]): string | undefined {
  if (!file) return undefined;
  const order = ["md", "sm", "hd", "xs", "400", "320", "240"];
  const keys = [...order.filter((k) => k in file), ...Object.keys(file)];
  for (const format of formats) {
    for (const key of keys) {
      const url = file[key]?.[format]?.url;
      if (url) return url;
    }
  }
  return undefined;
}

export const searchKlipyMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(1).max(120),
        kind: z.enum(["gifs", "clips", "stickers"]).default("gifs"),
        customerId: z.string().trim().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ items: KlipyItem[] }> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const klipyKey = process.env["KLIPY_API_KEY"];
    if (!lovableKey || !klipyKey) throw new Error("ยังไม่ได้เชื่อมต่อคลังคลิป KLIPY");

    const params = new URLSearchParams({
      q: data.query,
      customer_id: data.customerId,
      per_page: "24",
    });
    const response = await fetch(`${GATEWAY_URL}/${data.kind}/search?${params}`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": klipyKey,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`KLIPY search failed [${response.status}]: ${body}`);
      throw new Error(`ค้นหาคลิปไม่สำเร็จ [${response.status}]`);
    }
    const payload = (await response.json()) as { result?: boolean; data?: { data?: KlipyRaw[] } };
    if (!payload.result) throw new Error("คลังคลิปตอบกลับผิดพลาด");

    const items: KlipyItem[] = [];
    for (const raw of payload.data?.data ?? []) {
      const preview = pickUrl(raw.file, ["gif", "webp"]);
      const video = pickUrl(raw.file, ["mp4"]);
      const url = video ?? preview;
      if (!url || !preview) continue;
      items.push({
        id: String(raw.id ?? raw.slug ?? url),
        title: raw.title ?? raw.slug ?? "clip",
        previewUrl: preview,
        assetUrl: url,
        assetType: video ? "video" : "image",
      });
    }
    return { items };
  });
