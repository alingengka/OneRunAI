/**
 * The user's own stickers (uploaded pictures and Lottie animations), kept in
 * this browser so they can be reused in any project.
 */

export type LibrarySticker = {
  id: string;
  kind: "image" | "lottie";
  /** image data URL, or Lottie JSON text */
  asset: string;
  name: string;
};

const KEY = "onerun-sticker-library-v1";
const MAX_ITEMS = 30;
const MAX_IMAGE_SIDE = 512;
const MAX_LOTTIE_BYTES = 400_000;

export function loadStickerLibrary(): LibrarySticker[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LibrarySticker[]) : [];
  } catch {
    return [];
  }
}

/** Saves the library; returns false when the browser storage is full. */
export function saveStickerLibrary(items: LibrarySticker[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    return true;
  } catch {
    return false;
  }
}

/** Shrinks a picture to at most 512px and returns it as a data URL (transparency kept). */
async function imageToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("เปิดรูปนี้ไม่ได้"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.85);
    // Browsers without a WebP encoder fall back to PNG on their own.
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Turns an uploaded file into a library sticker, or throws a message for the user. */
export async function stickerFromFile(file: File): Promise<LibrarySticker> {
  const name = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "สติกเกอร์";
  const id = `lib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (/\.json$/i.test(file.name) || file.type === "application/json") {
    if (file.size > MAX_LOTTIE_BYTES) throw new Error("ไฟล์ Lottie ใหญ่เกิน 400KB");
    const text = await file.text();
    let data: { layers?: unknown; fr?: unknown };
    try {
      data = JSON.parse(text) as { layers?: unknown; fr?: unknown };
    } catch {
      throw new Error("ไฟล์ JSON นี้อ่านไม่ได้");
    }
    if (!Array.isArray(data.layers) || typeof data.fr !== "number") {
      throw new Error("ไฟล์นี้ไม่ใช่ Lottie animation");
    }
    return { id, kind: "lottie", asset: JSON.stringify(data), name };
  }
  if (!file.type.startsWith("image/"))
    throw new Error("รองรับรูป PNG, JPG, WebP หรือไฟล์ Lottie (.json)");
  return { id, kind: "image", asset: await imageToDataUrl(file), name };
}
