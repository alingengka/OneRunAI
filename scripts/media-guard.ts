/**
 * รั้วกันพังของวิดีโอและเสียง — ต้องรันก่อนส่งงานที่แตะการอ่านคลิป พรีวิว หรือส่งออก
 *
 *   bun run guard:media
 *
 * ต้องมี dev server ที่ http://localhost:8080 (เปลี่ยนด้วย GUARD_APP_URL) และ ffmpeg/ffprobe
 *
 * สร้างคลิปทดสอบด้วย ffmpeg แบบที่ลูกค้าเคยเจอปัญหาจริง แล้วอัปโหลด → ส่งออกผ่าน UI จริง
 * ในเบราว์เซอร์ 2 แบบ: Chrome บนคอม และ "Safari บน iPhone" จำลอง (จอมือถือ ไม่มี WebCodecs
 * AudioDecoder/AudioEncoder และ decodeAudioData อ่านเสียงจากไฟล์ที่มีภาพไม่ได้ — สาเหตุของ
 * "Decoding failed" ใน #91) แล้วตรวจไฟล์ที่ได้:
 *  - อ่านเสียงได้ ไม่มี error ขึ้นตอนอัปโหลด
 *  - ส่งออกได้ ขนาดภาพถูก จำนวนเฟรมครบ
 *  - มีแทร็กเสียงและไม่เงียบ (Cinematic/Spatial Audio เคยออกมาไม่มีเสียง #89)
 *  - ต้นคลิปไม่มีเฟรมดำ (#92)
 *  - คลิป 4K ใช้ไฟล์พรีวิว 720p ได้เมื่อเปิด ?proxy=1 และพรีวิวมีเสียง (#90)
 * ห้ามลดขอบเขตข้อใดข้อหนึ่งเพื่อให้ผ่าน
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, devices, type Browser, type Page } from "playwright";

const APP = process.env["GUARD_APP_URL"] ?? "http://localhost:8080";
const FPS = 30;
const failures: string[] = [];

/* ------------------------------ คลิปทดสอบ ------------------------------ */
const dir = mkdtempSync(join(tmpdir(), "media-guard-"));
const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
const bt709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"];
const h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", ...bt709];

type Fixture = { name: string; file: string; heavy?: boolean };

/** Real Lao speech, so the editor finds speech to keep (a steady tone has none). */
const SPEECH = "tests/fixtures/lao-sample.wav";
const SECONDS = 4;
const speech = ["-t", String(SECONDS), "-i", SPEECH];

function makeFixtures(): Fixture[] {
  const hd = join(dir, "hd.mp4");
  ffmpeg(
    "-f",
    "lavfi",
    "-i",
    `testsrc=s=1080x1920:r=${FPS}:d=${SECONDS}`,
    ...speech,
    ...h264,
    "-c:a",
    "aac",
    "-shortest",
    hd,
  );
  // iPhone 4K: landscape frames turned upright by rotation metadata
  const raw4k = join(dir, "4k-raw.mp4");
  ffmpeg(
    "-f",
    "lavfi",
    "-i",
    `testsrc=s=3840x2160:r=${FPS}:d=${SECONDS}`,
    ...speech,
    ...h264,
    "-c:a",
    "aac",
    "-shortest",
    raw4k,
  );
  const fourK = join(dir, "4k.mov");
  ffmpeg("-display_rotation", "90", "-i", raw4k, "-c", "copy", fourK);
  // Spatial Audio: the main (default) audio track is one browsers cannot decode
  // (APAC on a real iPhone, ALAC here), the stereo AAC track comes second
  const spatial = join(dir, "spatial.mov");
  ffmpeg(
    "-i",
    hd,
    "-f",
    "lavfi",
    "-i",
    `anoisesrc=d=${SECONDS}:a=0.0003`,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-map",
    "0:a",
    "-c:v",
    "copy",
    "-c:a:0",
    "alac",
    "-c:a:1",
    "aac",
    "-disposition:a:0",
    "default",
    "-disposition:a:1",
    "0",
    spatial,
  );
  // a clip that opens on black, like the first frames some iPhones decode
  const black = join(dir, "black-start.mp4");
  ffmpeg(
    "-f",
    "lavfi",
    "-i",
    `color=black:s=1080x1920:r=${FPS}:d=0.6`,
    "-f",
    "lavfi",
    "-i",
    `testsrc=s=1080x1920:r=${FPS}:d=${SECONDS - 0.6}`,
    ...speech,
    "-filter_complex",
    "[0:v][1:v]concat=n=2:v=1[v]",
    "-map",
    "[v]",
    "-map",
    "2:a",
    ...h264,
    "-c:a",
    "aac",
    "-shortest",
    black,
  );
  return [
    { name: "HD 1080p", file: hd },
    { name: "4K (หมุนด้วย metadata)", file: fourK, heavy: true },
    { name: "Spatial Audio (แทร็กหลักเล่นไม่ได้)", file: spatial },
    { name: "เฟรมดำต้นคลิป", file: black },
  ];
}

/* ------------------------------- เบราว์เซอร์ ------------------------------- */
type Mode = "chrome" | "iphone";

async function openEditor(browser: Browser, mode: Mode, proxy: boolean): Promise<Page> {
  const context = await browser.newContext({
    ...(mode === "iphone" ? devices["iPhone 13"] : { viewport: { width: 1440, height: 900 } }),
    acceptDownloads: true,
  });
  if (mode === "iphone") {
    await context.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w["AudioDecoder"];
      delete w["AudioEncoder"];
      const decode = BaseAudioContext.prototype.decodeAudioData;
      BaseAudioContext.prototype.decodeAudioData = function (data, ...rest) {
        // iPhone Safari cannot decode the audio of a whole phone video, only of
        // an audio-only file: refuse anything with a video track ("vide" handler)
        const bytes = new Uint8Array(data);
        let video = false;
        for (let i = 0; i + 3 < bytes.length && !video; i++) {
          video =
            bytes[i] === 0x76 &&
            bytes[i + 1] === 0x69 &&
            bytes[i + 2] === 0x64 &&
            bytes[i + 3] === 0x65;
        }
        if (video) {
          return Promise.reject(new DOMException("Decoding failed", "EncodingError"));
        }
        return decode.call(this, data, ...rest);
      };
    });
  }
  const page = await context.newPage();
  // the editor sits behind sign-in; the guard checks the editor itself
  await page.route(/AccessGate\.tsx/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export function AccessGate({ children }) { return children; }",
    }),
  );
  await page.goto(`${APP}/app${proxy ? "?proxy=1" : "?proxy=0"}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => !!(window as unknown as { __shortcutState?: unknown }).__shortcutState,
    undefined,
    {
      timeout: 90_000,
    },
  );
  return page;
}

const errorToasts = (page: Page) =>
  page.$$eval('[data-sonner-toast][data-type="error"]', (toasts) =>
    toasts.map((t) => (t.textContent ?? "").replace(/\s+/g, " ").trim()),
  );

/* ------------------------------ ตรวจไฟล์ส่งออก ------------------------------ */
function inspect(file: string) {
  const probe = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      file,
    ]).toString(),
  ) as { streams: { codec_type: string; width?: number; height?: number; nb_frames?: string }[] };
  const video = probe.streams.find((s) => s.codec_type === "video");
  const hasAudio = probe.streams.some((s) => s.codec_type === "audio");
  let volume = -Infinity;
  if (hasAudio) {
    const log = execFileSync("sh", [
      "-c",
      `ffmpeg -hide_banner -i "${file}" -map 0:a:0 -af volumedetect -f null - 2>&1 || true`,
    ]).toString();
    volume = Number(/mean_volume: (-?[\d.]+) dB/.exec(log)?.[1] ?? -Infinity);
  }
  const lumaLog = execFileSync("sh", [
    "-c",
    `ffmpeg -hide_banner -i "${file}" -vf "select='lt(n\\,5)',signalstats,metadata=print:key=lavfi.signalstats.YAVG" -an -f null - 2>&1 || true`,
  ]).toString();
  const openingBlack = [...lumaLog.matchAll(/YAVG=([\d.]+)/g)].filter(
    (m) => Number(m[1]) < 20,
  ).length;
  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    frames: Number(video?.nb_frames ?? 0),
    hasAudio,
    volume,
    openingBlack,
  };
}

/* --------------------------------- สถานการณ์ --------------------------------- */
async function run(browser: Browser, fixture: Fixture, mode: Mode, proxy: boolean): Promise<void> {
  const label = `[${mode === "iphone" ? "iPhone Safari จำลอง" : "Chrome"}${proxy ? " + ไฟล์พรีวิว" : ""}] ${fixture.name}`;
  const fail = (why: string) => failures.push(`${label}: ${why}`);
  const page = await openEditor(browser, mode, proxy);
  try {
    await page.locator('input[type="file"]').first().setInputFiles(fixture.file);
    // ready to edit: the audio is analysed and (with a preview copy) the copy is made
    await page
      .waitForFunction(
        () => {
          const s = (
            window as unknown as {
              __shortcutState?: {
                analyzing?: boolean;
                duration?: number;
                outputSegments?: unknown[];
              };
            }
          ).__shortcutState;
          return (
            !!s && !s.analyzing && (s.duration ?? 0) > 0 && (s.outputSegments?.length ?? 0) > 0
          );
        },
        undefined,
        { timeout: 120_000 },
      )
      .catch(() => fail("วิเคราะห์เสียงไม่เสร็จ"));
    if (proxy) {
      await page.waitForFunction(
        () => !/กำลังเตรียมพรีวิว/.test(document.body.innerText),
        undefined,
        {
          timeout: 240_000,
        },
      );
    }
    await page.waitForTimeout(1500);
    const uploadErrors = await errorToasts(page);
    if (uploadErrors.length) fail(`error ตอนอัปโหลด: ${uploadErrors.join(" | ")}`);

    if (proxy && fixture.heavy) {
      const preview = await page.evaluate(async () => {
        const v = document.querySelector("video")!;
        await new Promise((r) =>
          v.readyState >= 1 ? r(null) : v.addEventListener("loadedmetadata", r, { once: true }),
        );
        v.muted = true;
        const at = v.currentTime;
        await v.play().catch(() => undefined);
        await new Promise((r) => setTimeout(r, 1500));
        v.pause();
        return {
          width: Math.min(v.videoWidth, v.videoHeight),
          advanced: v.currentTime - at,
          audio:
            (v as HTMLVideoElement & { webkitAudioDecodedByteCount?: number })
              .webkitAudioDecodedByteCount ?? 0,
        };
      });
      if (preview.width !== 720) fail(`พรีวิวไม่ได้ใช้ไฟล์ 720p (ด้านสั้น ${preview.width})`);
      if (preview.advanced < 0.5) fail("พรีวิวกดเล่นแล้วไม่เดิน");
      if (preview.audio <= 0) fail("พรีวิวไม่มีเสียง");
    }

    // the editor cuts silent gaps: the export is as long as what it keeps
    const kept = await page.evaluate(() =>
      (
        (
          window as unknown as {
            __shortcutState?: { outputSegments?: { start: number; end: number }[] };
          }
        ).__shortcutState?.outputSegments ?? []
      ).reduce((sum, seg) => sum + (seg.end - seg.start), 0),
    );
    await page.getByRole("button", { name: "ส่งออก", exact: true }).last().click();
    const download = page.waitForEvent("download", { timeout: 300_000 });
    await page.getByRole("button", { name: "เรนเดอร์วิดีโอพร้อมซับ" }).last().click();
    const out = join(dir, `${Math.random().toString(36).slice(2)}.mp4`);
    await (await download).saveAs(out);
    const r = inspect(out);
    const expectedFrames = Math.round(kept * FPS);
    if (r.width !== 1080 || r.height !== 1920)
      fail(`ขนาดภาพ ${r.width}x${r.height} (ควรเป็น 1080x1920)`);
    if (Math.abs(r.frames - expectedFrames) > 3)
      fail(`เฟรม ${r.frames} (ควรประมาณ ${expectedFrames})`);
    if (!r.hasAudio) fail("ไฟล์ส่งออกไม่มีแทร็กเสียง");
    else if (r.volume < -50) fail(`เสียงในไฟล์ส่งออกเงียบ (${r.volume} dB)`);
    if (r.openingBlack > 0) fail(`ต้นคลิปมีเฟรมดำ ${r.openingBlack} เฟรม`);
    const mine = failures.filter((f) => f.startsWith(label)).map((f) => f.slice(label.length + 2));
    console.log(
      `${mine.length ? "❌" : "✅"} ${label} — ${r.width}x${r.height}, ${r.frames} เฟรม, เสียง ${r.hasAudio ? `${r.volume} dB` : "ไม่มี"}, เฟรมดำต้นคลิป ${r.openingBlack}${mine.length ? ` → ${mine.join("; ")}` : ""}`,
    );
  } catch (error) {
    fail(String(error).split("\n")[0]!);
    console.log(`❌ ${label} — ${String(error).split("\n")[0]}`);
  } finally {
    await page.context().close();
  }
}

async function main(): Promise<void> {
  // GUARD_ONLY=<ข้อความ> รันเฉพาะคลิปที่ชื่อมีข้อความนั้น (ไว้ไล่ปัญหา)
  const only = process.env["GUARD_ONLY"];
  const fixtures = makeFixtures().filter((f) => !only || f.name.includes(only));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ["chrome", "iphone"] as const) {
      for (const fixture of fixtures) await run(browser, fixture, mode, false);
      for (const fixture of fixtures.filter((f) => f.heavy || f.name.startsWith("Spatial"))) {
        await run(browser, fixture, mode, true);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.log("\n❌ MEDIA GUARD FAILED");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n✅ MEDIA GUARD PASSED");
}

await main();
