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

/** Used when the configured model name is unknown to the Gemini API. */
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

/**
 * Gemini chat completion; returns the first choice's text. If the configured
 * model does not exist for this API key, retries once with a stable model so
 * a wrong model name degrades quality instead of silently dropping Gemini.
 */
export async function geminiChat(
  model: string,
  messages: { role: "system" | "user"; content: ChatContent }[],
  label: string,
  options: { temperature?: number; retries?: number } = {},
): Promise<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const models = model === GEMINI_FALLBACK_MODEL ? [model] : [model, GEMINI_FALLBACK_MODEL];
  let lastError: Error | null = null;
  for (const candidate of models) {
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
      options.retries,
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
    if (!unknownModel) break;
    console.error(`[gemini] model ${candidate} unavailable, trying fallback`, body.slice(0, 300));
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
