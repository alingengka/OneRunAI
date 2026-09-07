/**
 * รั้วกันพัง (regression guard) สำหรับซับลาว — ต้องรันก่อนส่งงานทุกครั้ง
 *
 *   bun run scripts/lao-subtitle-guard.ts
 *
 * ตรวจ 2 มุม:
 *  (ก) ความแม่นยำถอดเสียง — รัน ensemble จริงกับคลิปคงที่ tests/fixtures/lao-sample.wav
 *      เทียบ CER กับ baseline ใน tests/fixtures/lao-sample.json (ห้ามแย่ลง)
 *  (ข) ความครบถ้วนของซับ — layout/burn ต้องวาดคำครบ 100% และอยู่ในกรอบภาพ
 *      ทดสอบทุกฟอนต์ในเมนู × (ปกติ / Bold / Italic / Bold+Italic)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { characterErrorRate, wordErrorRate } from "../src/lib/transcript-metrics";
import { transcribeAudioServer } from "../src/lib/transcribe.server";

type Baseline = { reference: string; cer: number; wer: number; recordedAt: string };

const FIXTURE = "tests/fixtures/lao-sample.wav";
const BASELINE = "tests/fixtures/lao-sample.json";
const APP = process.env["GUARD_APP_URL"] ?? "http://localhost:8080";
const UPDATE = process.argv.includes("--update-baseline");
const SKIP_STT = process.argv.includes("--layout-only");

const failures: string[] = [];

/* ---------------------------- (ก) ความแม่นยำ ---------------------------- */
async function checkAccuracy(): Promise<void> {
  if (SKIP_STT) {
    console.log("(ก) ข้ามการถอดเสียง (--layout-only)");
    return;
  }
  if (!existsSync(FIXTURE)) throw new Error(`ไม่พบคลิปทดสอบ ${FIXTURE}`);
  const audioBase64 = readFileSync(FIXTURE).toString("base64");
  const result = await transcribeAudioServer({ audioBase64, language: "lo" });
  const text = result.text.trim();

  if (UPDATE || !existsSync(BASELINE)) {
    const next: Baseline = { reference: text, cer: 0, wer: 0, recordedAt: new Date().toISOString() };
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`(ก) บันทึก baseline ใหม่: "${text}"`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  const cer = characterErrorRate(baseline.reference, text);
  const wer = wordErrorRate(baseline.reference, text);
  console.log(`(ก) ถอดเสียง: "${text}"`);
  console.log(`    CER ${cer.toFixed(3)} (baseline ${baseline.cer.toFixed(3)}) | WER ${wer.toFixed(3)} (baseline ${baseline.wer.toFixed(3)})`);
  if (cer > baseline.cer + 1e-9) failures.push(`CER แย่ลง: ${cer.toFixed(3)} > ${baseline.cer.toFixed(3)}`);
  if (wer > baseline.wer + 1e-9) failures.push(`WER แย่ลง: ${wer.toFixed(3)} > ${baseline.wer.toFixed(3)}`);
  if (!result.words?.length) failures.push("ไม่มี word timing จาก Scribe");
}

/* ------------------------- (ข) ความครบถ้วนของซับ ------------------------- */
const LAO_SENTENCE =
  "ສະບາຍດີ ທຸກຄົນ ມື້ນີ້ ພວກເຮົາ ຈະ ມາ ຮຽນ ພາສາ ລາວ ນຳ ກັນ ຢ່າ ລືມ ກົດ ຕິດຕາມ ເດີ້";

type LayoutRow = { font: string; bold: boolean; italic: boolean; expected: number; drawn: number; outside: number };

async function checkCompleteness(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(APP, { waitUntil: "load" });
  await page.waitForTimeout(2500);

  const rows = (await page.evaluate(async (sentence: string) => {
    const captions = (await import("/src/lib/captions.ts")) as typeof import("../src/lib/captions");
    const burn = (await import("/src/lib/media/burn-render.ts")) as typeof import("../src/lib/media/burn-render");

    const width = 1080;
    const height = 1920;
    const tokens = sentence.split(/\s+/).filter(Boolean);
    const words = tokens.map((text, i) => ({
      text,
      start: i * 0.4,
      end: i * 0.4 + 0.38,
      confidence: "high" as const,
    }));
    const group = { start: 0, end: tokens.length * 0.4, words };

    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;

    const out: {
      font: string;
      bold: boolean;
      italic: boolean;
      expected: number;
      drawn: number;
      outside: number;
    }[] = [];

    for (const option of captions.fontOptions) {
      for (const [bold, italic] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ] as const) {
        const style = {
          ...captions.baseStyle,
          fontFamily: option.value,
          bold,
          italic,
          wordsPerGroup: tokens.length,
        };
        await burn.ensureCaptionFonts(style);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;

        // ดักการวาดตัวอักษรจริงเพื่อ "นับคำที่ปรากฏ" และตำแหน่ง x
        const painted = new Map<string, { minX: number; maxX: number }>();
        const originalFill = ctx.fillText.bind(ctx);
        ctx.fillText = ((text: string, x: number, y: number) => {
          const w = ctx.measureText(text).width;
          const t = ctx.getTransform();
          const x0 = t.a * x + t.e;
          const x1 = t.a * (x + w) + t.c * 0 + t.e;
          const prev = painted.get(text);
          painted.set(text, {
            minX: Math.min(prev?.minX ?? x0, x0),
            maxX: Math.max(prev?.maxX ?? x1, x1),
          });
          return originalFill(text, x, y);
        }) as typeof ctx.fillText;

        const renderer = burn.createBurnRenderer(ctx, width, height, [group], style, {});
        for (const w of words) {
          renderer.paint(source, (w.start + w.end) / 2, { start: 0, end: group.end } as never);
        }

        const drawn = tokens.filter((t) => painted.has(t)).length;
        const outside = tokens.filter((t) => {
          const box = painted.get(t);
          return !!box && (box.minX < 0 || box.maxX > width);
        }).length;
        out.push({ font: option.label, bold, italic, expected: tokens.length, drawn, outside });
      }
    }
    return out;
  }, LAO_SENTENCE)) as LayoutRow[];

  await browser.close();

  let bad = 0;
  for (const row of rows) {
    const label = `${row.font} [${row.bold ? "B" : "-"}${row.italic ? "I" : "-"}]`;
    if (row.drawn !== row.expected || row.outside > 0) {
      bad++;
      failures.push(`${label}: วาด ${row.drawn}/${row.expected} คำ, หลุดกรอบ ${row.outside} คำ`);
      console.log(`    ✗ ${label}: ${row.drawn}/${row.expected}, หลุดกรอบ ${row.outside}`);
    }
  }
  console.log(`(ข) layout/burn: ตรวจ ${rows.length} กรณี (ฟอนต์ × B/I) — ผ่าน ${rows.length - bad}, ไม่ผ่าน ${bad}`);
}

await checkAccuracy();
await checkCompleteness();

if (failures.length) {
  console.error(`\n❌ LAO SUBTITLE GUARD FAILED (${failures.length})`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("\n✅ LAO SUBTITLE GUARD PASSED");
