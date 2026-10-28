/**
 * Direct AI provider calls, using the project's own API keys.
 *
 * - GEMINI_API_KEY  (required) — Lao transcription + subtitle translation
 * - OPENAI_API_KEY  (optional) — extra gpt-4o-transcribe candidates
 * - ELEVENLABS_API_KEY (optional, read in transcribe.server.ts) — Lao Scribe
 *
 * Gemini is called through its OpenAI-compatible endpoint so request/response
 * shapes stay the same as the chat-completions API.
 */

import { readRateLimit } from "./gemini-limits";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE = "https://api.openai.com/v1";

export const GEMINI_TRANSCRIBE_MODEL = process.env["GEMINI_TRANSCRIBE_MODEL"] || "gemini-3.7-flash";
export const GEMINI_TRANSLATE_MODEL = process.env["GEMINI_TRANSLATE_MODEL"] || "gemini-2.5-flash";
export const OPENAI_TRANSCRIBE_MODEL =
  process.env["OPENAI_TRANSCRIBE_MODEL"] || "gpt-4o-transcribe";

/**
 * fetch that retries rate limits and transient overloads (429/502/503) with a
 * short backoff. Parallel chunk transcription can briefly exceed free-tier
 * request limits; a retry is cheaper than dropping an engine.
 */
/** A provider that did not answer in time; callers move on to their fallback. */
export class ProviderTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`No answer within ${Math.round(ms / 1000)}s from ${new URL(url).host}`);
    this.name = "ProviderTimeoutError";
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
  // A provider that hangs must not hold the whole request until the platform
  // cuts it off minutes later (the editor sat at "0/6" meanwhile): give up
  // and let the caller fall back. A timeout is not retried, it would only
  // double the wait.
  timeoutMs = 45_000,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new ProviderTimeoutError(url, timeoutMs);
      }
      throw error;
    }
    if (attempt >= retries || ![429, 502, 503].includes(response.status)) return response;
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 10
        ? retryAfter * 1000
        : 1500 * (attempt + 1) + Math.random() * 500;
    await response.body?.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export function geminiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"] || undefined;
}

export function openaiKey(): string | undefined {
  return process.env["OPENAI_API_KEY"] || undefined;
}

type ChatContent =
  | string
  | (
      | { type: "text"; text: string }
      | { type: "input_audio"; input_audio: { data: string; format: "wav" } }
    )[];

/**
 * Tried in order after the configured model. Each Gemini model has its own
 * free-tier quota, so when one is used up ([429] "exceeded your current
 * quota") the next model still answers.
 */
const GEMINI_FALLBACK_MODELS = (
  process.env["GEMINI_FALLBACK_MODELS"] || "gemini-2.5-flash,gemini-2.5-flash-lite"
)
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

/** Models that recently answered 429, skipped until the time stored here. */
const cooledDown = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000;
/** Models Google answered 404 for (retired), skipped for a day. */
const RETIRED_MS = 24 * 60 * 60 * 1000;
/** Google's "model is overloaded right now" (503 and friends) passes quickly. */
const BUSY_MS = 60 * 1000;
/** A per-minute limit clears within a minute; only a daily one needs COOLDOWN_MS. */
const MINUTE_LIMIT_MS = 60 * 1000;
/** Longest wait for a per-minute limit before retrying the same model once. */
const MAX_LIMIT_WAIT_MS = 20 * 1000;

let lastRateLimitAt = 0;
/** True when any Gemini call hit a rate limit within the last `withinMs`. */
export function geminiRecentlyLimited(withinMs = 60 * 1000): boolean {
  return Date.now() - lastRateLimitAt < withinMs;
}

/**
 * Flash models this key can use right now, newest first (full models before
 * "lite"). Google retires model names over time; asking the API means a
 * retirement degrades to the next model instead of failing transcription.
 */
let discovered: { at: number; models: string[] } | null = null;
async function discoverFlashModels(apiKey: string): Promise<string[]> {
  if (discovered && Date.now() - discovered.at < 60 * 60 * 1000) return discovered.models;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
      { headers: { "x-goog-api-key": apiKey } },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    const version = (name: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0);
    const models = (payload.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((name) => /^gemini-[\d.]+-flash/.test(name))
      .filter((name) => !/(image|tts|live|audio|embedding|thinking)/.test(name))
      .sort((a, b) => {
        const lite = Number(a.includes("lite")) - Number(b.includes("lite"));
        return lite || version(b) - version(a) || a.length - b.length;
      });
    discovered = { at: Date.now(), models };
    return models;
  } catch {
    return [];
  }
}

function isCoolingDown(model: string): boolean {
  const until = cooledDown.get(model);
  if (!until) return false;
  if (Date.now() < until) return true;
  cooledDown.delete(model);
  return false;
}

/**
 * Gemini chat completion; returns the first choice's text. When the model is
 * unknown for this key or its quota is used up, the next fallback model is
 * tried, so a limit degrades quality instead of dropping Gemini entirely.
 * `fallback: false` keeps a best-effort call on the first model only.
 */
export async function geminiChat(
  model: string,
  messages: { role: "system" | "user"; content: ChatContent }[],
  label: string,
  options: {
    temperature?: number;
    retries?: number;
    fallback?: boolean;
    timeoutMs?: number;
    /** Skip "lite" models: for Lao they answer, but with wrong words. */
    noLite?: boolean;
    /** On a short per-minute limit, wait and ask the same model once more. */
    waitOnLimit?: boolean;
  } = {},
): Promise<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const chain =
    options.fallback === false
      ? [model]
      : [model, ...GEMINI_FALLBACK_MODELS.filter((name) => name !== model)].filter(
          (name) => name === model || !(options.noLite && name.includes("lite")),
        );
  // When every model is resting, try them anyway rather than fail without asking.
  const resting = chain.filter((name) => !isCoolingDown(name));
  const models = resting.length ? resting : [...chain];
  let lastError: Error | null = null;
  let searched = options.fallback === false;
  let waited = false;
  for (let index = 0; ; index++) {
    if (index >= models.length) {
      // Everything configured is retired or out of quota: ask Google which
      // flash models exist now and keep going with those.
      if (searched) break;
      searched = true;
      for (const name of await discoverFlashModels(apiKey)) {
        if (options.noLite && name.includes("lite")) continue;
        if (!models.includes(name) && !isCoolingDown(name)) models.push(name);
      }
      if (index >= models.length) break;
    }
    const candidate = models[index]!;
    const hasNext = index < models.length - 1 || !searched;
    let response: Response;
    try {
      response = await fetchWithRetry(
        `${GEMINI_BASE}/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: candidate,
            messages,
            ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          }),
        },
        // A model with a fallback behind it only gets one quick retry.
        hasNext ? Math.min(options.retries ?? 2, 1) : options.retries,
        options.timeoutMs,
      );
    } catch (error) {
      if (!(error instanceof ProviderTimeoutError)) throw error;
      // too slow right now: rest it briefly and ask the next model
      lastError = new Error(`${label} failed (${candidate}): ${error.message}`);
      cooledDown.set(candidate, Date.now() + BUSY_MS);
      console.error(`[gemini] ${candidate} timed out, trying next model`);
      continue;
    }
    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return (payload.choices?.[0]?.message?.content ?? "").trim();
    }
    const body = await response.text().catch(() => "");
    lastError = new Error(
      `${label} failed [${response.status}] (${candidate}): ${body.slice(0, 300)}`,
    );
    const unknownModel =
      response.status === 404 || (response.status === 400 && /model/i.test(body));
    const limited = response.status === 429;
    const busy = [500, 502, 503, 504].includes(response.status);
    if (limited) {
      lastRateLimitAt = Date.now();
      const limit = readRateLimit(body, response.headers.get("retry-after"));
      // Free-tier limits are mostly per minute: waiting a few seconds keeps the
      // main model, where moving on would hand the clip to a weaker one.
      const wait = limit.waitMs ?? 5000;
      if (!limit.daily && options.waitOnLimit && !waited && wait <= MAX_LIMIT_WAIT_MS) {
        waited = true;
        console.error(
          `[gemini] ${candidate} rate limited, retrying in ${Math.round(wait / 1000)}s`,
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
        index--;
        continue;
      }
      cooledDown.set(candidate, Date.now() + (limit.daily ? COOLDOWN_MS : MINUTE_LIMIT_MS));
    } else if (unknownModel) cooledDown.set(candidate, Date.now() + RETIRED_MS);
    else if (busy) cooledDown.set(candidate, Date.now() + BUSY_MS);
    if (!unknownModel && !limited && !busy) break;
    console.error(
      `[gemini] ${candidate} unavailable [${response.status}], trying next model`,
      body.slice(0, 200),
    );
  }
  throw (
    lastError ?? new Error(`${label} failed [429]: Gemini quota is used up for ${chain.join(", ")}`)
  );
}

/** OpenAI audio transcription. The form must not include `model`. */
export function openaiTranscribe(form: FormData): Promise<Response> {
  const apiKey = openaiKey();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  return fetchWithRetry(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
}
