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
const ONLY_INTEGRATION = process.argv.includes("--integration-only");

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
  // WER เป็นตัวชี้วัดรอง: เครื่องถอดเสียงเว้นวรรคไม่คงที่ระหว่างรอบ แม้ตัวอักษรจะตรงกัน 100%
  if (wer > Math.max(0.75, baseline.wer + 0.25)) failures.push(`WER แย่ลงผิดปกติ: ${wer.toFixed(3)}`);
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

/* ---------- (ค) integration ผ่าน UI จริง: อัปโหลด → สร้างซับด้วย AI → เรนเดอร์ ---------- */
type IntegrationRow = { font: string; bold: boolean; italic: boolean; expected: number; drawn: number; outside: number; groupsMissed: number };

async function checkIntegration(): Promise<void> {
  if (SKIP_STT) {
    console.log("(ค) ข้าม integration ผ่าน UI (--layout-only)");
    return;
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1800 } });
  const page = await context.newPage();
  await page.goto(APP, { waitUntil: "load" });
  // ต้องรอให้ React hydrate เสร็จก่อน มิฉะนั้น change event ของ input จะไม่มีตัวรับ
  // (สาเหตุจริงที่ทำให้ปุ่ม "สร้างซับด้วย AI" ค้าง disabled ตอนทดสอบอัตโนมัติ)
  await page.waitForFunction(() => !!(window as unknown as { __shortcutState?: unknown }).__shortcutState, undefined, {
    timeout: 60_000,
  });

  const aiButton = page.getByRole("button", { name: "สร้างซับด้วย AI", exact: true });
  await aiButton.waitFor({ state: "visible", timeout: 30_000 });

  // ป้อนไฟล์แล้วยืนยันว่า state รับไฟล์จริง ถ้าไม่ติดให้ลองใหม่ (กัน hydration race)
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.setInputFiles('input[type="file"]', FIXTURE);
    try {
      await page.waitForFunction(
        () => {
          const btns = [...document.querySelectorAll("button")].filter((b) =>
            b.textContent?.includes("สร้างซับด้วย AI"),
          );
          return btns.length > 0 && btns.every((b) => !(b as HTMLButtonElement).disabled);
        },
        undefined,
        { timeout: 20_000 },
      );
      break;
    } catch (e) {
      if (attempt === 3) throw new Error("อัปโหลดไฟล์แล้วปุ่ม 'สร้างซับด้วย AI' ยังถูก disable");
      await page.setInputFiles('input[type="file"]', []);
    }
  }

  await page.getByRole("button", { name: "ລາວ", exact: true }).first().click();
  await aiButton.click();


  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __shortcutState?: { words?: unknown[]; transcribing?: boolean } }).__shortcutState;
      return !!s && !s.transcribing && !!s.words?.length;
    },
    undefined,
    { timeout: 180_000 },
  );

  const rows = (await page.evaluate(async () => {
    const state = (window as unknown as {
      __shortcutState: {
        words: import("../src/lib/captions").Word[];
        groups: import("../src/lib/captions").CaptionGroup[];
        style: import("../src/lib/captions").CaptionStyle;
        duration: number;
      };
    }).__shortcutState;
    const captions = (await import("/src/lib/captions.ts")) as typeof import("../src/lib/captions");
    const burn = (await import("/src/lib/media/burn-render.ts")) as typeof import("../src/lib/media/burn-render");

    const width = 1080;
    const height = 1920;
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
      groupsMissed: number;
    }[] = [];

    for (const option of captions.fontOptions) {
      for (const [bold, italic] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ] as const) {
        const style = { ...state.style, fontFamily: option.value, bold, italic };
        const groups = captions.groupWords(state.words, style.wordsPerGroup);
        const expectedWords = new Set(
          state.words.map((w) => (style.uppercase ? w.text.toUpperCase() : w.text)).filter((t) => t !== captions.LINE_BREAK),
        );
        await burn.ensureCaptionFonts(style);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        const painted = new Map<string, { minX: number; maxX: number }>();
        const originalFill = ctx.fillText.bind(ctx);
        ctx.fillText = ((text: string, x: number, y: number) => {
          const w = ctx.measureText(text).width;
          const t = ctx.getTransform();
          const x0 = t.a * x + t.e;
          const x1 = t.a * (x + w) + t.e;
          const prev = painted.get(text);
          painted.set(text, { minX: Math.min(prev?.minX ?? x0, x0), maxX: Math.max(prev?.maxX ?? x1, x1) });
          return originalFill(text, x, y);
        }) as typeof ctx.fillText;

        const renderer = burn.createBurnRenderer(ctx, width, height, groups, style, {});
        const end = Math.max(state.duration || 0, ...groups.map((g) => g.end)) + 0.2;
        // เดินไล่ทุกเฟรม 30fps เหมือนตอน export จริง
        for (let t = 0; t <= end; t += 1 / 30) renderer.paint(source, t, { start: 0, end } as never);

        // ทุกกลุ่มต้องปรากฏอย่างน้อยหนึ่งเฟรมตรงกลางช่วงของมัน
        let groupsMissed = 0;
        for (const g of groups) {
          const before = painted.size;
          renderer.paint(source, (g.start + g.end) / 2, { start: 0, end } as never);
          const visible = g.words.filter((w) => w.text !== captions.LINE_BREAK);
          const shown = visible.every((w) => painted.has(style.uppercase ? w.text.toUpperCase() : w.text));
          if (!shown && painted.size === before) groupsMissed++;
        }

        const drawn = [...expectedWords].filter((t) => painted.has(t)).length;
        const outside = [...expectedWords].filter((t) => {
          const box = painted.get(t);
          return !!box && (box.minX < 0 || box.maxX > width);
        }).length;
        out.push({ font: option.label, bold, italic, expected: expectedWords.size, drawn, outside, groupsMissed });
      }
    }
    return out;
  })) as IntegrationRow[];

  await browser.close();

  let bad = 0;
  for (const row of rows) {
    const label = `${row.font} [${row.bold ? "B" : "-"}${row.italic ? "I" : "-"}]`;
    if (row.drawn !== row.expected || row.outside > 0 || row.groupsMissed > 0) {
      bad++;
      failures.push(`UI ${label}: วาด ${row.drawn}/${row.expected} คำ, หลุดกรอบ ${row.outside}, กลุ่มที่ไม่ขึ้นเลย ${row.groupsMissed}`);
      console.log(`    ✗ ${label}: ${row.drawn}/${row.expected}, หลุดกรอบ ${row.outside}, กลุ่มหาย ${row.groupsMissed}`);
    }
  }
  console.log(`(ค) integration ผ่าน UI จริง: ตรวจ ${rows.length} กรณี — ผ่าน ${rows.length - bad}, ไม่ผ่าน ${bad}`);
}

/* ---- (ง) กันซับหายจากกลุ่มเวลาที่ซ้อนกัน (เกิดจริงเมื่อคำมาจาก chunk ที่ overlap) ---- */
async function checkOverlapWindows(): Promise<void> {
  const { findWindow } = await import("../src/lib/media/burn-render");
  let misses = 0;
  let samples = 0;
  for (let trial = 0; trial < 500; trial++) {
    const list: { start: number; end: number }[] = [];
    let cursor = 0;
    for (let i = 0; i < 14; i++) {
      const start = Math.max(0, cursor - (Math.random() < 0.4 ? Math.random() * 0.6 : 0));
      const end = start + 0.3 + Math.random() * 1.5;
      list.push({ start, end });
      cursor = end + Math.random() * 0.3;
    }
    list.sort((a, b) => a.start - b.start);
    for (let t = 0; t < cursor; t += 0.05) {
      samples++;
      const linear = list.find((g) => t >= g.start - 0.02 && t <= g.end + 0.02) ?? null;
      if (linear && !findWindow(list, t, 0.02)) misses++;
    }
  }
  console.log(`(ง) ช่วงซับที่ซ้อนกัน: สุ่ม ${samples} จุดเวลา — ซับหาย ${misses} จุด`);
  if (misses) failures.push(`findWindow ทำซับหาย ${misses} จุดเมื่อกลุ่มเวลาซ้อนกัน`);
}

if (!ONLY_INTEGRATION) {
  await checkAccuracy();
  await checkCompleteness();
}
await checkOverlapWindows();
await checkIntegration();


if (failures.length) {
  console.error(`\n❌ LAO SUBTITLE GUARD FAILED (${failures.length})`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("\n✅ LAO SUBTITLE GUARD PASSED");
