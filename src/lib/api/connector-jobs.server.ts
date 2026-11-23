/**
 * Storage and jobs behind the Claude connector: Claude uploads a WAV to a
 * signed URL, then a job turns it into subtitles over one or more requests.
 */
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reserveAiSeconds } from "@/lib/account.server";
import { transcribeAudioServer } from "@/lib/transcribe.server";
import { isAccountError } from "@/lib/account-shared";
import type { CaptionMode } from "@/lib/captions";
import { parseWav } from "./wav";
import {
  jobProgress,
  jobResult,
  planJob,
  runRound,
  type JobResult,
  type JobState,
  type Language,
} from "./subtitle-pipeline";

const BUCKET = "connector-audio";
/** Longest audio a job takes, in seconds. */
const MAX_SECONDS = 80 * 60;
/** How long one request keeps starting new chunks; Claude waits 240 s per tool call. */
const ROUND_MS = 110_000;
/** A request that died keeps the job for at most this long. */
const LEASE_MS = 230_000;

const jobs = () => supabaseAdmin.from("connector_jobs" as never) as unknown as JobsTable;

// The table is newer than the generated database types.
type JobRow = {
  id: string;
  user_id: string;
  audio_path: string;
  state: JobState & { options?: ResultOptions };
  status: "running" | "done" | "failed";
  error: string | null;
};
type Query = PromiseLike<{ data: JobRow[] | null; error: { message: string } | null }> & {
  eq(column: string, value: string): Query;
  or(filter: string): Query;
  select(columns?: string): Query;
};
type JobsTable = {
  insert(row: Partial<JobRow>): { select(columns?: string): Query };
  update(row: Record<string, unknown>): Query;
  select(columns?: string): Query;
};

export type ResultOptions = { captionMode?: CaptionMode; wordsPerCaption?: number };

/** A signed URL Claude can PUT the WAV to, valid for two hours. */
export async function createUpload(userId: string) {
  const path = `${userId}/${randomUUID()}.wav`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`สร้างลิงก์อัปโหลดไม่สำเร็จ: ${error?.message ?? ""}`);
  return { uploadId: path.split("/")[1]!.replace(/\.wav$/, ""), uploadUrl: data.signedUrl };
}

async function readAudio(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(
      "ยังไม่พบไฟล์เสียงที่อัปโหลด กรุณาอัปโหลดด้วยลิงก์ที่ได้มาก่อน แล้วลองอีกครั้ง",
    );
  }
  return parseWav(new Uint8Array(await data.arrayBuffer()));
}

export type JobReport =
  | { status: "done"; jobId: string; result: JobResult }
  | { status: "running"; jobId: string; done: number; total: number }
  | { status: "failed"; jobId: string; error: string };

/** Takes the job for this request, or null when another request has it. */
async function lease(jobId: string, userId: string): Promise<JobRow | null> {
  const now = new Date();
  const { data, error } = await jobs()
    .update({ lease_until: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("*");
  if (error) throw new Error(`อ่านงานไม่สำเร็จ: ${error.message}`);
  return data?.[0] ?? null;
}

async function save(row: JobRow, patch: Partial<JobRow>) {
  const { error } = await jobs()
    .update({ ...patch, lease_until: null, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw new Error(`บันทึกงานไม่สำเร็จ: ${error.message}`);
}

function report(row: JobRow): JobReport {
  if (row.status === "failed") return { status: "failed", jobId: row.id, error: row.error ?? "" };
  if (row.status === "done" || row.state.done) {
    return { status: "done", jobId: row.id, result: jobResult(row.state, row.state.options) };
  }
  return { status: "running", jobId: row.id, ...jobProgress(row.state) };
}

/** Works on a job until the round's time is up, then reports where it is. */
async function work(row: JobRow): Promise<JobReport> {
  if (row.status !== "running") {
    await save(row, {});
    return report(row);
  }
  try {
    const buffer = await readAudio(row.audio_path);
    await runRound(buffer, row.state, {
      deadline: Date.now() + ROUND_MS,
      transcribe: (input) => transcribeAudioServer(input),
      reserve: (seconds) => reserveAiSeconds(row.user_id, seconds, "transcribe"),
      isFatal: isAccountError,
    });
  } catch (error) {
    // Out of quota or plan expired: keep the work done so far; asking again
    // after renewing carries on from here.
    await save(row, { state: row.state });
    throw error;
  }
  const done = row.state.done;
  await save(row, { state: row.state, status: done ? "done" : "running" });
  if (done) {
    // The audio is no longer needed once the subtitles exist.
    await supabaseAdmin.storage
      .from(BUCKET)
      .remove([row.audio_path])
      .then(
        () => undefined,
        () => undefined,
      );
  }
  return report({ ...row, status: done ? "done" : "running" });
}

export async function startJob(
  userId: string,
  input: { uploadId: string; language: Language; glossary: string[] } & ResultOptions,
): Promise<JobReport> {
  if (!/^[0-9a-f-]{36}$/.test(input.uploadId)) throw new Error("upload_id ไม่ถูกต้อง");
  const audioPath = `${userId}/${input.uploadId}.wav`;
  const buffer = await readAudio(audioPath);
  if (buffer.duration > MAX_SECONDS) {
    throw new Error(`ไฟล์เสียงยาวเกิน ${MAX_SECONDS / 60} นาที กรุณาแบ่งเป็นหลายไฟล์`);
  }
  const state = {
    ...planJob(buffer, input.language, input.glossary),
    options: {
      ...(input.captionMode ? { captionMode: input.captionMode } : {}),
      ...(input.wordsPerCaption ? { wordsPerCaption: input.wordsPerCaption } : {}),
    },
  };
  const { data, error } = await jobs()
    .insert({
      user_id: userId,
      audio_path: audioPath,
      state,
      lease_until: new Date(Date.now() + LEASE_MS).toISOString(),
    } as Partial<JobRow>)
    .select("*");
  const row = data?.[0];
  if (error || !row) throw new Error(`สร้างงานไม่สำเร็จ: ${error?.message ?? ""}`);
  return work(row);
}

export async function continueJob(userId: string, jobId: string): Promise<JobReport> {
  if (!/^[0-9a-f-]{36}$/.test(jobId)) throw new Error("job_id ไม่ถูกต้อง");
  const row = await lease(jobId, userId);
  if (row) return work(row);
  const { data } = await jobs().select("*").eq("id", jobId).eq("user_id", userId);
  const current = data?.[0];
  if (!current) throw new Error("ไม่พบงานนี้");
  // Another request is working on it right now.
  return report(current);
}
