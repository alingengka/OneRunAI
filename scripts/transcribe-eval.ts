/**
 * วัดคุณภาพการถอดซับลาวทั้งคลิป ผ่าน UI จริง ด้วย AI จริง (Gemini + ElevenLabs)
 *
 *   GEMINI_API_KEY=... ELEVENLABS_API_KEY=... bun run scripts/transcribe-eval.ts [--runs 2] [--json out.json]
 *
 * ต้องมี dev server ที่ http://localhost:8080 (GUARD_APP_URL) และ ffmpeg
 *
 * ไม่แตะระบบล็อกอินหรือโควตาของเว็บจริง: หน้า editor ถูกเปิดโดยข้าม AccessGate และ
 * server function ถอดเสียงถูกแทนด้วยเซิร์ฟเวอร์ทดสอบในเครื่องที่เรียก transcribeAudioServer
 * ตรงๆ — โค้ดแบ่งช่วง/รวมคำ/จัดเวลาฝั่ง editor ยังเป็นของจริงทั้งหมด
 *
 * วัด:
 *  - คำผี: คำที่ขึ้นในช่วงที่รู้แน่ว่าไม่มีคนพูด (ช่วงเงียบ/เสียงรบกวนที่ใส่เข้าไปเอง)
 *  - คำซ้ำ: วลี (2 คำขึ้นไป) ที่ซ้ำติดกัน มักเกิดตรงรอยต่อระหว่างช่วง
 *  - CER: เทียบกับคำตอบที่ถูกต้อง (คลิปที่ประกอบจากเสียงที่รู้ข้อความแน่นอน)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { characterErrorRate } from "../src/lib/transcript-metrics";
import { transcribeAudioServer } from "../src/lib/transcribe.server";

const APP = process.env["GUARD_APP_URL"] ?? "http://localhost:8080";
const PORT = 8787;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const RUNS = Number(arg("--runs") ?? 1);
const JSON_OUT = arg("--json");

/* ----------------------- เซิร์ฟเวอร์ถอดเสียงทดสอบ ----------------------- */
const server = Bun.serve({
  port: PORT,
  idleTimeout: 255,
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      const data = (await request.json()) as Parameters<typeof transcribeAudioServer>[0];
      const result = await transcribeAudioServer(data);
      if (process.env["EVAL_DEBUG"]) {
        const seconds = (data.audioBase64.length * 0.75 - 44) / 32000;
        console.log(
          `   [ช่วง ${seconds.toFixed(1)}s] เลือก: "${result.text}" | ตัวเลือก: ${result.alternatives.map((a) => `"${a}"`).join(" / ")} | Scribe: "${(result.words ?? []).map((w) => w.text).join(" ")}"`,
        );
      }
      return Response.json(result, { headers: cors });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500, headers: cors });
    }
  },
});

/* ------------------------------ คลิปทดสอบ ------------------------------ */
const dir = mkdtempSync(join(tmpdir(), "transcribe-eval-"));
const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
const duration = (file: string) =>
  Number(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]).toString(),
  );

const SAMPLE = "tests/fixtures/lao-sample.wav";
const SAMPLE_TEXT = "ສະບາຍດີ ທຸກຄົນ ມື້ນີ້ ພວກເຮົາ ຈະມາຮຽນພາສາລາວ ນຳກັນ";
const sampleLen = duration(SAMPLE);

type Piece = { file?: string; silence?: number; noise?: number; text?: string };
type Fixture = {
  name: string;
  file: string;
  reference: string | null;
  gaps: { start: number; end: number }[];
};

/** Joins speech and filler (silence, room noise) into one clip and records where nobody speaks. */
function compose(name: string, pieces: Piece[]): Fixture {
  const inputs: string[] = [];
  const labels: string[] = [];
  const gaps: { start: number; end: number }[] = [];
  const texts: string[] = [];
  let at = 0;
  pieces.forEach((piece, i) => {
    if (piece.file) {
      inputs.push("-i", piece.file);
      labels.push(`[${i}:a]aresample=16000,aformat=channel_layouts=mono[a${i}]`);
      at += duration(piece.file);
      if (piece.text) texts.push(piece.text);
    } else {
      const seconds = piece.silence ?? piece.noise ?? 0;
      const source = piece.silence
        ? `anullsrc=r=16000:cl=mono:d=${seconds}`
        : `anoisesrc=d=${seconds}:c=pink:a=0.02:r=16000`;
      inputs.push("-f", "lavfi", "-i", source);
      labels.push(`[${i}:a]aformat=channel_layouts=mono[a${i}]`);
      gaps.push({ start: at, end: at + seconds });
      at += seconds;
    }
  });
  const audio = join(dir, `${name}.wav`);
  ffmpeg(
    ...inputs,
    "-filter_complex",
    `${labels.join(";")};${pieces.map((_, i) => `[a${i}]`).join("")}concat=n=${pieces.length}:v=0:a=1[out]`,
    "-map",
    "[out]",
    audio,
  );
  const file = join(dir, `${name}.mp4`);
  ffmpeg(
    "-f",
    "lavfi",
    "-i",
    `color=c=gray:s=540x960:r=30:d=${at}`,
    "-i",
    audio,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    file,
  );
  return {
    name,
    file,
    reference: texts.length === pieces.filter((p) => p.file).length ? texts.join(" ") : null,
    gaps,
  };
}

function fixtures(): Fixture[] {
  const only = process.env["EVAL_ONLY"];
  return (
    [
      compose("silence-gaps", [
        { file: SAMPLE, text: SAMPLE_TEXT },
        { silence: 2.5 },
        { file: SAMPLE, text: SAMPLE_TEXT },
        { silence: 1.8 },
        { file: SAMPLE, text: SAMPLE_TEXT },
      ]),
      compose("noise-gaps", [
        { file: SAMPLE, text: SAMPLE_TEXT },
        { noise: 2 },
        { file: SAMPLE, text: SAMPLE_TEXT },
        { noise: 0.5 },
        { silence: 1 },
        { file: SAMPLE, text: SAMPLE_TEXT },
      ]),
      compose("codeswitch-long", [
        { file: "tests/fixtures/lao-codeswitch.wav" },
        { silence: 2 },
        { file: "tests/fixtures/lao-long.wav" },
        { noise: 1.5 },
        { file: "tests/fixtures/lao-codeswitch.wav" },
      ]),
    ] as Fixture[]
  ).filter((f) => !only || f.name.includes(only));
}
void sampleLen;

/* ------------------------------- ถอดผ่าน UI ------------------------------- */
type Word = { text: string; start: number; end: number };

async function transcribeInEditor(browser: Browser, file: string): Promise<Word[]> {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  await page.route(/AccessGate\.tsx/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export function AccessGate({ children }) { return children; }",
    }),
  );
  await page.route(/transcribe\.functions\.ts/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const transcribeAudio = async ({ data }) => {
        const r = await fetch("http://127.0.0.1:${PORT}/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "transcribe failed");
        return body;
      };`,
    }),
  );
  try {
    await page.goto(`${APP}/app?proxy=0`, { waitUntil: "load" });
    await page.waitForFunction(
      () => !!(window as unknown as { __shortcutState?: unknown }).__shortcutState,
      undefined,
      {
        timeout: 90_000,
      },
    );
    await page.getByRole("button", { name: "ລາວ", exact: true }).first().click();
    await page.locator('input[type="file"]').first().setInputFiles(file);
    const ai = page.getByRole("button", { name: "สร้างซับด้วย AI", exact: true });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("button")]
          .filter((b) => b.textContent?.includes("สร้างซับด้วย AI"))
          .every((b) => !(b as HTMLButtonElement).disabled),
      undefined,
      { timeout: 60_000 },
    );
    await ai.click();
    await page.waitForFunction(
      () => {
        const s = (
          window as unknown as { __shortcutState?: { words?: unknown[]; transcribing?: boolean } }
        ).__shortcutState;
        return !!s && !s.transcribing && !!s.words?.length;
      },
      undefined,
      { timeout: 600_000 },
    );
    return await page.evaluate(() =>
      ((window as unknown as { __shortcutState: { words: Word[] } }).__shortcutState.words ?? [])
        .filter((w) => w.text && w.text !== "\n")
        .map((w) => ({ text: w.text, start: w.start, end: w.end })),
    );
  } finally {
    await page.context().close();
  }
}

/* -------------------------------- คะแนน -------------------------------- */
function score(fixture: Fixture, words: Word[]) {
  const margin = 0.15;
  if (process.env["EVAL_DEBUG"]) {
    for (const g of fixture.gaps) {
      const near = words.filter((w) => w.end > g.start - 1 && w.start < g.end + 1);
      console.log(
        `   ช่วงไม่มีคนพูด ${g.start.toFixed(2)}–${g.end.toFixed(2)}s: ` +
          near.map((w) => `${w.text}[${w.start.toFixed(2)}–${w.end.toFixed(2)}]`).join(" "),
      );
    }
  }
  const phantom = words.filter((w) => {
    const mid = (w.start + w.end) / 2;
    return fixture.gaps.some((g) => mid > g.start + margin && mid < g.end - margin);
  });
  const texts = words.map((w) => w.text);
  let repeats = 0;
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + 2 * n <= texts.length; i++) {
      if (texts.slice(i, i + n).join(" ") === texts.slice(i + n, i + 2 * n).join(" ")) repeats++;
    }
  }
  const hypothesis = texts.join(" ");
  const cer = fixture.reference ? characterErrorRate(fixture.reference, hypothesis) : null;
  return {
    words: words.length,
    phantom: phantom.length,
    phantomWords: phantom.map((w) => w.text),
    repeats,
    cer,
    hypothesis,
  };
}

async function main() {
  const list = fixtures();
  const browser = await chromium.launch({ headless: true });
  const results: Record<string, ReturnType<typeof score>[]> = {};
  try {
    for (const fixture of list) {
      results[fixture.name] = [];
      for (let run = 0; run < RUNS; run++) {
        const words = await transcribeInEditor(browser, fixture.file);
        const r = score(fixture, words);
        results[fixture.name]!.push(r);
        console.log(
          `${fixture.name} #${run + 1}: คำ ${r.words}, คำผี ${r.phantom}${r.phantom ? ` (${r.phantomWords.join(" ")})` : ""}, ` +
            `วลีซ้ำ ${r.repeats}${r.cer != null ? `, CER ${r.cer.toFixed(3)}` : ""}`,
        );
        console.log(`   "${r.hypothesis}"`);
      }
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  const all = Object.values(results).flat();
  const cers = all.map((r) => r.cer).filter((c): c is number => c != null);
  const summary = {
    phantom: all.reduce((n, r) => n + r.phantom, 0),
    repeats: all.reduce((n, r) => n + r.repeats, 0),
    meanCer: cers.length ? cers.reduce((a, b) => a + b, 0) / cers.length : null,
  };
  console.log(
    `\nรวม: คำผี ${summary.phantom}, วลีซ้ำ ${summary.repeats}, CER เฉลี่ย ${summary.meanCer?.toFixed(3) ?? "-"}`,
  );
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ summary, results }, null, 2));
}

await main();
