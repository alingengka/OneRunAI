/**
 * Claude connector checks without network: WAV reading, the subtitle job
 * across rounds (as saved between requests), quota stops, the MCP protocol
 * and which sign-in redirects are trusted.
 *   bun src/lib/api/connector.test.ts
 */
import { encodeWav16k } from "@/lib/media/audio";
import { trustedRedirect } from "@/lib/oauth-redirect";
import { handleMcpRequest } from "./mcp.server";
import { jobProgress, jobResult, planJob, runRound, type TranscribeFn } from "./subtitle-pipeline";
import { parseWav, type PcmBuffer } from "./wav";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** 1.6 s bursts of noise ("speech") with 1 s of silence between them. */
function speechLike(bursts: number, rate = 16000): PcmBuffer {
  const length = Math.round((bursts * 2.6 + 1) * rate);
  const data = new Float32Array(length);
  let seed = 1;
  for (let b = 0; b < bursts; b++) {
    const from = Math.round((0.5 + b * 2.6) * rate);
    for (let i = 0; i < 1.6 * rate; i++) {
      seed = (seed * 16807) % 2147483647;
      data[from + i] = ((seed / 2147483647) * 2 - 1) * 0.4 * Math.sin((Math.PI * i) / (1.6 * rate));
    }
  }
  return {
    sampleRate: rate,
    length,
    duration: length / rate,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
}

const saveAndLoad = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// WAV written by the editor reads back with the same length and samples.
{
  const source = speechLike(3);
  const wav = new Uint8Array(await encodeWav16k(source as unknown as AudioBuffer).arrayBuffer());
  const read = parseWav(wav);
  assert(read.sampleRate === 16000 && read.numberOfChannels === 1, "wav format");
  assert(Math.abs(read.duration - source.duration) < 0.01, `wav duration ${read.duration}`);
  const a = source.getChannelData(0);
  const b = read.getChannelData(0);
  let maxDiff = 0;
  for (let i = 0; i < a.length; i += 97) maxDiff = Math.max(maxDiff, Math.abs(a[i]! - b[i]!));
  assert(maxDiff < 0.001, `wav samples differ by ${maxDiff}`);
  let threw = false;
  try {
    parseWav(new TextEncoder().encode("not a wav file at all, just some text here....."));
  } catch {
    threw = true;
  }
  assert(threw, "non-WAV input is refused");
}

/** A fake engine: says "ສະບາຍດີ" once per second of audio, with word times. */
const calls: number[] = [];
const fakeTranscribe =
  (fail: (call: number) => Error | null = () => null): TranscribeFn =>
  async ({ audioBase64 }) => {
    const call = calls.push(1);
    const error = fail(call);
    if (error) throw error;
    const seconds = (Buffer.from(audioBase64, "base64").length - 44) / 32000;
    const count = Math.max(1, Math.floor(seconds));
    const words = Array.from({ length: count }, (_, i) => ({
      text: "ສະບາຍດີ",
      start: i * (seconds / count),
      end: (i + 0.8) * (seconds / count),
    }));
    return { text: words.map((w) => w.text).join(" "), agreement: 0.9, words };
  };

// A job finishes over several short rounds, saved as JSON in between.
{
  const buffer = speechLike(12);
  let state = planJob(buffer, "lo", []);
  assert(state.chunks.length > 1, `expected several chunks, got ${state.chunks.length}`);
  let rounds = 0;
  let reserved = 0;
  while (!state.done && rounds < 50) {
    rounds++;
    let started = 0;
    await runRound(buffer, state, {
      transcribe: fakeTranscribe(),
      // only lets the first chunk(s) start each round
      deadline: Date.now() + 1,
      reserve: async (seconds) => {
        started++;
        reserved += seconds;
        return async () => {
          reserved -= seconds;
        };
      },
    });
    assert(started <= 3, "a round starts at most one chunk per lane after the deadline");
    state = saveAndLoad(state);
  }
  assert(state.done, `job not done after ${rounds} rounds`);
  assert(rounds > 1, "the job needed more than one round");
  const progress = jobProgress(state);
  assert(progress.done === progress.total, "progress complete");
  const result = jobResult(state);
  assert(/^1\n\d\d:\d\d:\d\d,\d{3} --> /.test(result.srt), `srt: ${result.srt.slice(0, 80)}`);
  assert(result.srt.includes("ສະບາຍດີ"), "srt has the words");
  assert(result.failed.length === 0, "nothing failed");
  assert(reserved > 0, "quota was reserved");
}

// A chunk that keeps failing is tried 3 times, refunded, then reported.
{
  const buffer = speechLike(2);
  const state = planJob(buffer, "lo", []);
  let refunds = 0;
  calls.length = 0;
  await runRound(buffer, state, {
    transcribe: fakeTranscribe(() => new Error("provider down")),
    deadline: Date.now() + 10_000,
    reserve: async () => async () => {
      refunds++;
    },
  });
  assert(state.done, "a job with only failed chunks still finishes");
  const failedChunks = state.chunks.filter((c) => c.status === "failed").length;
  assert(failedChunks === state.chunks.length, "every chunk failed");
  assert(refunds === calls.length, `refunded ${refunds} of ${calls.length} tries`);
  assert(jobResult(state).failed.length === state.chunks.length, "failed ranges are reported");
}

// No quota: the round stops, keeps what was done, and can carry on later.
{
  const buffer = speechLike(12);
  let state = planJob(buffer, "lo", []);
  let allowed = 1;
  let threw: unknown = null;
  try {
    await runRound(buffer, state, {
      transcribe: fakeTranscribe(),
      deadline: Date.now() + 10_000,
      reserve: async () => {
        if (allowed-- <= 0) throw new Error("QUOTA_EXCEEDED");
        return async () => undefined;
      },
      isFatal: (e) => String(e).includes("QUOTA"),
    });
  } catch (error) {
    threw = error;
  }
  assert(String(threw).includes("QUOTA_EXCEEDED"), "quota error reaches the caller");
  state = saveAndLoad(state);
  assert(!state.done, "job is not done");
  assert(state.chunks.filter((c) => c.status === "done").length === 1, "the paid chunk is kept");
  assert(!state.chunks.some((c) => c.status === "failed"), "no chunk counted as failed");
  await runRound(buffer, state, { transcribe: fakeTranscribe(), deadline: Date.now() + 10_000 });
  assert(state.done, "job finishes after renewing");
}

// MCP: sign-in is required, then tools list and run.
{
  const deps = {
    getAccount: async () => ({ status: "trial" }),
    createUpload: async () => ({
      uploadId: "11111111-1111-1111-1111-111111111111",
      uploadUrl: "https://storage.example/upload?token=t",
    }),
    startJob: async () => ({ status: "running" as const, jobId: "job-1", done: 1, total: 4 }),
    continueJob: async () => ({
      status: "done" as const,
      jobId: "job-1",
      result: { srt: "1\n00:00:00,000 --> 00:00:01,000\nສະບາຍດີ\n", text: "", failed: [] },
    }),
  };
  const post = async (body: unknown, token: string | null = "a.b.c") =>
    handleMcpRequest(
      new Request("https://www.onerunai.com/api/mcp", {
        method: "POST",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-06-18",
        },
        body: JSON.stringify(body),
      }),
      {
        verify: async (t) => (t === "a.b.c" ? { userId: "user-1", email: null } : null),
        deps,
      },
    );
  const init = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "t", version: "1" },
    },
  };

  const anonymous = await post(init, null);
  assert(anonymous.status === 401, `no token: ${anonymous.status}`);
  assert(
    anonymous.headers.get("www-authenticate") ===
      'Bearer resource_metadata="https://www.onerunai.com/.well-known/oauth-protected-resource"',
    `www-authenticate: ${anonymous.headers.get("www-authenticate")}`,
  );
  assert((await post(init, "x.y.z")).status === 401, "bad token is refused");

  const initialized = (await (await post(init)).json()) as { result: { protocolVersion: string } };
  assert(initialized.result.protocolVersion === "2025-06-18", "initialize");

  const list = (await (await post({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json()) as {
    result: { tools: { name: string }[] };
  };
  const names = list.result.tools.map((t) => t.name).sort();
  assert(
    names.join() === "create_subtitles,get_account_status,get_subtitles,prepare_audio_upload",
    `tools: ${names}`,
  );

  type CallResult = { result: { content: { text: string }[]; isError?: boolean } };
  const call = async (name: string, args: unknown) =>
    (
      (await (
        await post({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name, arguments: args },
        })
      ).json()) as CallResult
    ).result;

  const upload = await call("prepare_audio_upload", {});
  assert(upload.content[0]!.text.includes("upload_id: 11111111-"), "upload id");
  assert(upload.content[0]!.text.includes("ffmpeg -i"), "ffmpeg help");
  const started = await call("create_subtitles", {
    upload_id: "11111111-1111-1111-1111-111111111111",
  });
  assert(
    started.content[0]!.text.includes('job_id "job-1"'),
    "running job tells Claude to continue",
  );
  const done = await call("get_subtitles", { job_id: "job-1" });
  assert(done.content[0]!.text.includes("ສະບາຍດີ"), "srt returned");
  const bad = await call("create_subtitles", { language: "fr" });
  assert(bad.isError === true, "bad arguments are an error result");
}

// Sign-ins only go to Claude or an app on this computer.
{
  assert(trustedRedirect("https://claude.ai/api/mcp/auth_callback") === "claude", "claude.ai");
  assert(trustedRedirect("https://claude.com/api/mcp/auth_callback") === "claude", "claude.com");
  assert(trustedRedirect("http://localhost:3118/callback") === "local", "claude code");
  assert(trustedRedirect("http://127.0.0.1:5000/cb") === "local", "loopback");
  assert(
    trustedRedirect("https://claude.ai.evil.example/api/mcp/auth_callback") === null,
    "lookalike",
  );
  assert(trustedRedirect("https://evil.example/cb") === null, "other site");
  assert(trustedRedirect("http://claude.ai/api/mcp/auth_callback") === null, "plain http");
  assert(trustedRedirect("https://claude.ai/other") === null, "other path");
  assert(trustedRedirect("not a url") === null, "garbage");
}

console.log("connector tests passed");
