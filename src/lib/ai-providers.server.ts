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
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
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
  options: { temperature?: number; retries?: number; fallback?: boolean } = {},
): Promise<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const chain =
    options.fallback === false
      ? [model]
      : [model, ...GEMINI_FALLBACK_MODELS.filter((name) => name !== model)];
  const models = chain.filter((name) => !isCoolingDown(name));
  if (!models.length) {
    throw new Error(`${label} failed [429]: Gemini quota is used up for ${chain.join(", ")}`);
  }
  let lastError: Error | null = null;
  for (const [index, candidate] of models.entries()) {
    const hasNext = index < models.length - 1;
    const response = await fetchWithRetry(
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
    );
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
    if (limited) cooledDown.set(candidate, Date.now() + COOLDOWN_MS);
    if (!unknownModel && !limited) break;
    console.error(
      `[gemini] ${candidate} unavailable [${response.status}], trying next model`,
      body.slice(0, 200),
    );
  }
  throw lastError ?? new Error(`${label} failed`);
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
