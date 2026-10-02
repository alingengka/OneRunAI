/**
 * Stickers drawn over the video: animated emoji (Google Noto Emoji Lottie
 * files bundled under /public/lottie/emoji, CC BY 4.0) and motion graphics
 * drawn with plain canvas code. The same layer paints the editor preview and
 * the exported file, so both always match.
 */

/** "image" and "lottie" are the user's own uploads (data URL / Lottie JSON text). */
export type StickerKind = "emoji" | "graphic" | "image" | "lottie";

export type GraphicId =
  "arrow" | "circle" | "underline" | "sparkles" | "follow" | "heart" | "check" | "burst";

export type Sticker = {
  id: string;
  kind: StickerKind;
  /** emoji code point (e.g. "1f525"), a GraphicId, an image data URL or Lottie JSON text */
  asset: string;
  /** source-video seconds */
  start: number;
  end: number;
  /** center, in % of the frame */
  x: number;
  y: number;
  /** box size, in % of the frame height */
  size: number;
  /** degrees */
  rotation: number;
  /** main color for motion graphics */
  color?: string | undefined;
};

export type EmojiAsset = { code: string; char: string; keywords: string[] };

/** Bundled Noto animated emoji, with words that suggest them (Lao, Thai, English). */
export const EMOJIS: EmojiAsset[] = [
  {
    code: "1f602",
    char: "😂",
    keywords: ["ຫົວ", "ຕະຫຼົກ", "ขำ", "ตลก", "ฮา", "funny", "lol", "haha"],
  },
  { code: "1f923", char: "🤣", keywords: ["ຂຳ", "ຫົວແຮງ", "ขำมาก", "ฮามาก", "rofl"] },
  {
    code: "1f60d",
    char: "😍",
    keywords: ["ງາມ", "ສວຍ", "ສວຍງາມ", "สวย", "งาม", "beautiful", "pretty"],
  },
  { code: "1f970", char: "🥰", keywords: ["ຮັກ", "ໜ້າຮັກ", "รัก", "น่ารัก", "cute", "love"] },
  { code: "1f62d", char: "😭", keywords: ["ຮ້ອງໄຫ້", "ເສົ້າ", "ร้องไห้", "เศร้า", "sad", "cry"] },
  { code: "1f631", char: "😱", keywords: ["ຕົກໃຈ", "ຢ້ານ", "ตกใจ", "กลัว", "shock", "scared"] },
  { code: "1f62e", char: "😮", keywords: ["ວ້າວ", "ว้าว", "wow"] },
  { code: "1f92f", char: "🤯", keywords: ["ບໍ່ໜ້າເຊື່ອ", "ไม่น่าเชื่อ", "mindblown", "crazy"] },
  { code: "1f60e", char: "😎", keywords: ["ເທ່", "ເຈ໋ງ", "เท่", "เจ๋ง", "cool"] },
  {
    code: "1f914",
    char: "🤔",
    keywords: ["ຄິດ", "ສົງໄສ", "ເປັນຫຍັງ", "คิด", "สงสัย", "ทำไม", "why", "think"],
  },
  { code: "1f644", char: "🙄", keywords: ["ເບື່ອ", "เบื่อ", "bored"] },
  { code: "1f621", char: "😡", keywords: ["ໃຈຮ້າຍ", "ໂມໂຫ", "โกรธ", "โมโห", "angry"] },
  { code: "1f97a", char: "🥺", keywords: ["ຂໍຮ້ອງ", "ขอร้อง", "please"] },
  { code: "1f634", char: "😴", keywords: ["ນອນ", "ງ່ວງ", "นอน", "ง่วง", "sleep", "tired"] },
  {
    code: "1f924",
    char: "🤤",
    keywords: ["ຢາກກິນ", "ອາຫານ", "อยากกิน", "อาหาร", "food", "hungry"],
  },
  {
    code: "1f60b",
    char: "😋",
    keywords: ["ແຊບ", "ອ່ອຍ", "แซ่บ", "อร่อย", "delicious", "yummy", "tasty"],
  },
  {
    code: "1f929",
    char: "🤩",
    keywords: ["ສຸດຍອດ", "ເກັ່ງ", "สุดยอด", "เก่ง", "amazing", "awesome"],
  },
  {
    code: "1f973",
    char: "🥳",
    keywords: ["ສະຫຼອງ", "ວັນເກີດ", "ฉลอง", "วันเกิด", "party", "birthday"],
  },
  { code: "1f607", char: "😇", keywords: ["ດີ", "ใจดี", "kind", "angel"] },
  { code: "1f605", char: "😅", keywords: ["ອາຍ", "อาย", "oops"] },
  {
    code: "1f525",
    char: "🔥",
    keywords: ["ຮ້ອນ", "ແຮງ", "ຮິດ", "ร้อน", "แรง", "ฮิต", "hot", "fire", "viral"],
  },
  { code: "1f4af", char: "💯", keywords: ["ຮ້ອຍ", "ແທ້", "ร้อย", "จริง", "100", "perfect"] },
  { code: "2764_fe0f", char: "❤️", keywords: ["ຫົວໃຈ", "หัวใจ", "heart"] },
  { code: "1f494", char: "💔", keywords: ["ອົກຫັກ", "อกหัก", "heartbreak"] },
  { code: "1f44d", char: "👍", keywords: ["ດີຫຼາຍ", "ດີເລີດ", "ดีมาก", "เยี่ยม", "good", "like"] },
  { code: "1f44f", char: "👏", keywords: ["ຕົບມື", "ปรบมือ", "clap", "congrats"] },
  { code: "1f64f", char: "🙏", keywords: ["ຂອບໃຈ", "ຂອບໃຈຫຼາຍ", "ขอบคุณ", "thank", "thanks"] },
  {
    code: "1f4aa",
    char: "💪",
    keywords: ["ສູ້", "ແຂງແຮງ", "ສູ້ໆ", "สู้", "แข็งแรง", "strong", "gym"],
  },
  { code: "1f440", char: "👀", keywords: ["ເບິ່ງ", "ເບິ່ງນີ້", "ดู", "look", "see", "watch"] },
  {
    code: "2728",
    char: "✨",
    keywords: ["ໃໝ່", "ພິເສດ", "ใหม่", "พิเศษ", "new", "special", "magic"],
  },
  { code: "1f389", char: "🎉", keywords: ["ຍິນດີ", "ยินดี", "congratulations", "yay"] },
  { code: "1f4a5", char: "💥", keywords: ["ບູມ", "ระเบิด", "boom"] },
  {
    code: "1f4b8",
    char: "💸",
    keywords: ["ເງິນ", "ລາຄາ", "ຈ່າຍ", "เงิน", "ราคา", "จ่าย", "money", "price"],
  },
  { code: "1f911", char: "🤑", keywords: ["ລວຍ", "ກຳໄລ", "รวย", "กำไร", "rich", "profit"] },
  {
    code: "1f680",
    char: "🚀",
    keywords: ["ໄວ", "ເລີ່ມ", "เร็ว", "เริ่ม", "fast", "launch", "boost"],
  },
  { code: "26a1", char: "⚡", keywords: ["ດ່ວນ", "ด่วน", "quick", "flash"] },
  {
    code: "2705",
    char: "✅",
    keywords: ["ຖືກ", "ແມ່ນ", "ຖືກຕ້ອງ", "ถูก", "ใช่", "yes", "correct"],
  },
  { code: "274c", char: "❌", keywords: ["ຜິດ", "ບໍ່ແມ່ນ", "ผิด", "ไม่ใช่", "wrong", "no"] },
  { code: "2b50", char: "⭐", keywords: ["ດາວ", "ດີທີ່ສຸດ", "ดาว", "ดีที่สุด", "star", "best"] },
  { code: "1f3af", char: "🎯", keywords: ["ເປົ້າໝາຍ", "ເປົ້າ", "เป้าหมาย", "goal", "target"] },
];

export const GRAPHICS: { id: GraphicId; label: string; color: string }[] = [
  { id: "arrow", label: "ลูกศรชี้", color: "#facc15" },
  { id: "circle", label: "วงกลมเน้น", color: "#ef4444" },
  { id: "underline", label: "ขีดเส้นใต้", color: "#facc15" },
  { id: "sparkles", label: "ประกายดาว", color: "#fde047" },
  { id: "follow", label: "ปุ่ม Follow", color: "#fe2c55" },
  { id: "heart", label: "หัวใจเด้ง", color: "#fe2c55" },
  { id: "check", label: "เครื่องหมายถูก", color: "#22c55e" },
  { id: "burst", label: "ป้าย NEW", color: "#8b5cf6" },
];

export const NOTO_CREDIT = "อิโมจิเคลื่อนไหว: Google Noto Emoji (CC BY 4.0)";

export const emojiUrl = (code: string) => `/lottie/emoji/${code}.json`;

let counter = 0;
export function newStickerId(): string {
  counter += 1;
  return `st-${Date.now().toString(36)}-${counter}`;
}

/** Stickers with a word that suggests an emoji, at most one every `gap` seconds. */
export function suggestEmojiStickers(
  words: { text: string; start: number; end: number }[],
  options: { gap?: number; max?: number } = {},
): Sticker[] {
  const gap = options.gap ?? 3;
  const max = options.max ?? 12;
  const out: Sticker[] = [];
  let lastAt = -Infinity;
  let side = 0;
  for (const word of words) {
    if (out.length >= max) break;
    if (word.start - lastAt < gap) continue;
    const text = word.text.toLowerCase().replace(/[.,!?…"'“”]/g, "");
    if (!text) continue;
    const match = EMOJIS.find((emoji) =>
      emoji.keywords.some(
        (keyword) => text === keyword || (keyword.length >= 3 && text.includes(keyword)),
      ),
    );
    if (!match) continue;
    out.push({
      id: newStickerId(),
      kind: "emoji",
      asset: match.code,
      start: Math.max(0, word.start - 0.1),
      end: word.start + 1.6,
      x: side % 2 === 0 ? 76 : 24,
      y: 40,
      size: 16,
      rotation: side % 2 === 0 ? 8 : -8,
    });
    side++;
    lastAt = word.start;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Overshoots past 1 then settles; for pop-in entrances. */
const easeBack = (t: number) => {
  const c = 1.7;
  const x = clamp01(t) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

/** Draws a motion graphic centered at 0,0 inside a box of size `s`. `t` = seconds since start. */
function drawGraphic(
  ctx: CanvasRenderingContext2D,
  id: string,
  t: number,
  s: number,
  color: string,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = s * 0.04;
  ctx.shadowOffsetY = s * 0.015;

  switch (id) {
    case "arrow": {
      const enter = easeOut(t / 0.35);
      const bob = Math.sin(t * Math.PI * 2.4) * s * 0.06 * enter;
      ctx.globalAlpha *= enter;
      ctx.translate(-s * 0.25 * (1 - enter) + bob, 0);
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, 0);
      ctx.lineTo(s * 0.22, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.44, 0);
      ctx.lineTo(s * 0.08, -s * 0.26);
      ctx.lineTo(s * 0.08, s * 0.26);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "circle": {
      const p = easeOut(t / 0.55);
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      // a hand-drawn loop that overshoots its start a little
      ctx.ellipse(
        0,
        0,
        s * 0.46,
        s * 0.34,
        -0.12,
        -Math.PI * 0.55,
        -Math.PI * 0.55 + Math.PI * 2.15 * p,
      );
      ctx.stroke();
      break;
    }
    case "underline": {
      const p = easeOut(t / 0.4);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps * p; i++) {
        const u = i / steps;
        const x = -s * 0.48 + u * s * 0.96;
        const y = Math.sin(u * Math.PI) * s * 0.06 + u * s * 0.03;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case "sparkles": {
      const stars = [
        [-0.3, -0.2, 0.22, 0],
        [0.28, -0.28, 0.16, 0.15],
        [0.18, 0.26, 0.2, 0.3],
        [-0.22, 0.3, 0.12, 0.45],
      ] as const;
      for (const [x, y, r, delay] of stars) {
        const local = t - delay;
        if (local < 0) continue;
        const twinkle = 0.75 + 0.25 * Math.sin(local * 7 + x * 10);
        const scale = easeBack(local / 0.35) * twinkle * r * s;
        ctx.save();
        ctx.translate(x * s, y * s);
        ctx.rotate(local * 1.5);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const radius = i % 2 === 0 ? scale : scale * 0.28;
          const angle = (i * Math.PI) / 4;
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "follow": {
      const pop = easeBack(t / 0.4);
      const tapped = t > 1.0;
      const press = t > 0.85 && t < 1.05 ? 0.92 : 1;
      ctx.scale(pop * press, pop * press);
      const w = s * 0.96;
      const h = s * 0.34;
      ctx.fillStyle = tapped ? "#2f2f35" : color;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${h * 0.46}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tapped ? "✓ Following" : "+ Follow", 0, h * 0.02);
      // tapping finger
      if (t > 0.45 && t < 1.4) {
        const reach = easeOut((t - 0.45) / 0.4);
        ctx.font = `${h * 0.9}px system-ui, sans-serif`;
        ctx.fillText("👆", w * 0.3, h * (1.25 - 0.55 * reach));
      }
      break;
    }
    case "heart": {
      const beat = easeBack(t / 0.35) * (1 + 0.08 * Math.max(0, Math.sin(t * Math.PI * 3)));
      ctx.scale(beat, beat);
      const r = s * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.75);
      ctx.bezierCurveTo(-r * 1.25, -r * 0.1, -r * 0.55, -r * 1.05, 0, -r * 0.42);
      ctx.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.25, -r * 0.1, 0, r * 0.75);
      ctx.fill();
      break;
    }
    case "check": {
      const ring = easeBack(t / 0.35);
      ctx.scale(ring, ring);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      const p = easeOut((t - 0.2) / 0.35);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      const a = [-s * 0.2, 0];
      const b = [-s * 0.05, s * 0.15];
      const c = [s * 0.22, -s * 0.14];
      ctx.moveTo(a[0]!, a[1]!);
      if (p < 0.4) {
        const k = p / 0.4;
        ctx.lineTo(a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k);
      } else {
        const k = (p - 0.4) / 0.6;
        ctx.lineTo(b[0]!, b[1]!);
        ctx.lineTo(b[0]! + (c[0]! - b[0]!) * k, b[1]! + (c[1]! - b[1]!) * k);
      }
      if (p > 0) ctx.stroke();
      break;
    }
    case "burst": {
      const pop = easeBack(t / 0.35);
      ctx.scale(pop, pop);
      ctx.rotate(Math.sin(t * 3) * 0.08);
      ctx.beginPath();
      const spikes = 14;
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? s * 0.48 : s * 0.38;
        const angle = (i * Math.PI) / spikes;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${s * 0.26}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NEW", 0, s * 0.01);
      break;
    }
  }
}

type LottieAnimation = {
  totalFrames: number;
  frameRate: number;
  goToAndStop: (value: number, isFrame?: boolean) => void;
  destroy: () => void;
};

type EmojiPlayer = { canvas: HTMLCanvasElement; anim: LottieAnimation; lastFrame: number };

export type StickerLayer = {
  /** Loads the emoji animations the stickers use (call before drawing). */
  prepare: (stickers: Sticker[]) => Promise<void>;
  /** Paints the stickers visible at `time` onto a frame of width × height. */
  draw: (
    ctx: CanvasRenderingContext2D,
    stickers: Sticker[],
    time: number,
    width: number,
    height: number,
  ) => void;
  destroy: () => void;
};

/** Fades and pops a sticker in and out around its time window. */
function stickerEnvelope(sticker: Sticker, time: number): { alpha: number; scale: number } {
  const local = time - sticker.start;
  const left = sticker.end - time;
  const enter = clamp01(local / 0.18);
  const exit = clamp01(left / 0.18);
  return {
    alpha: Math.min(enter, exit),
    scale: sticker.kind === "graphic" ? 1 : 0.6 + 0.4 * easeBack(local / 0.3),
  };
}

export function createStickerLayer(resolution = 512): StickerLayer {
  const players = new Map<string, Promise<EmojiPlayer | null>>();
  const ready = new Map<string, EmojiPlayer>();
  const images = new Map<string, Promise<HTMLImageElement | null>>();
  const readyImages = new Map<string, HTMLImageElement>();

  const loadImage = (src: string) => {
    let pending = images.get(src);
    if (!pending) {
      pending = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          readyImages.set(src, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
      images.set(src, pending);
    }
    return pending;
  };

  /** `key` is an emoji code, or Lottie JSON text for an uploaded animation. */
  const load = (key: string, kind: "emoji" | "lottie" = "emoji") => {
    let pending = players.get(key);
    if (!pending) {
      const code = key;
      pending = (async () => {
        try {
          const [{ default: lottie }, data] = await Promise.all([
            import("lottie-web/build/player/lottie_light_canvas"),
            kind === "lottie"
              ? Promise.resolve(JSON.parse(key) as unknown)
              : fetch(emojiUrl(code)).then((r) =>
                  r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
                ),
          ]);
          const canvas = document.createElement("canvas");
          canvas.width = resolution;
          canvas.height = resolution;
          const context = canvas.getContext("2d");
          if (!context) return null;
          // The light canvas build's typings only describe the SVG renderer.
          const config = {
            renderer: "canvas",
            loop: true,
            autoplay: false,
            animationData: data,
            rendererSettings: { context, clearCanvas: true, preserveAspectRatio: "xMidYMid meet" },
          } as unknown as Parameters<typeof lottie.loadAnimation>[0];
          const anim = lottie.loadAnimation(config) as unknown as LottieAnimation;
          const player = { canvas, anim, lastFrame: -1 };
          ready.set(code, player);
          return player;
        } catch (error) {
          console.error(
            `[stickers] ${kind === "lottie" ? "lottie" : `emoji ${code}`} failed to load`,
            error,
          );
          return null;
        }
      })();
      players.set(key, pending);
    }
    return pending;
  };

  return {
    async prepare(stickers) {
      const codes = new Set(stickers.filter((s) => s.kind === "emoji").map((s) => s.asset));
      const lotties = new Set(stickers.filter((s) => s.kind === "lottie").map((s) => s.asset));
      const pics = new Set(stickers.filter((s) => s.kind === "image").map((s) => s.asset));
      await Promise.all([
        ...[...codes].map((code) => load(code)),
        ...[...lotties].map((json) => load(json, "lottie")),
        ...[...pics].map(loadImage),
      ]);
    },
    draw(ctx, stickers, time, width, height) {
      for (const sticker of stickers) {
        if (time < sticker.start || time > sticker.end) continue;
        const { alpha, scale } = stickerEnvelope(sticker, time);
        if (alpha <= 0) continue;
        const box = (sticker.size / 100) * height;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.translate((sticker.x / 100) * width, (sticker.y / 100) * height);
        if (sticker.rotation) ctx.rotate((sticker.rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        if (sticker.kind === "image") {
          const img = readyImages.get(sticker.asset);
          if (!img) void loadImage(sticker.asset);
          else {
            // fit inside the square box, keeping the picture's proportions
            const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
            const w = ratio >= 1 ? box : box * ratio;
            const h = ratio >= 1 ? box / ratio : box;
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
          }
        } else if (sticker.kind === "emoji" || sticker.kind === "lottie") {
          const player = ready.get(sticker.asset);
          if (!player) void load(sticker.asset, sticker.kind);
          else {
            const frames = Math.max(1, player.anim.totalFrames);
            const frame = Math.floor(((time - sticker.start) * player.anim.frameRate) % frames);
            if (frame !== player.lastFrame) {
              player.anim.goToAndStop(frame, true);
              player.lastFrame = frame;
            }
            ctx.drawImage(player.canvas, -box / 2, -box / 2, box, box);
          }
        } else {
          const color =
            sticker.color ?? GRAPHICS.find((g) => g.id === sticker.asset)?.color ?? "#facc15";
          drawGraphic(ctx, sticker.asset, time - sticker.start, box, color);
        }
        ctx.restore();
      }
    },
    destroy() {
      for (const player of ready.values()) player.anim.destroy();
      ready.clear();
      players.clear();
      images.clear();
      readyImages.clear();
    },
  };
}
