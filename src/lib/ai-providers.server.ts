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

/** Gemini chat completion; returns the first choice's text. */
export async function geminiChat(
  model: string,
  messages: { role: "system" | "user"; content: ChatContent }[],
  label: string,
): Promise<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  const response = await fetch(`${GEMINI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${label} failed [${response.status}]: ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return (payload.choices?.[0]?.message?.content ?? "").trim();
}

/** OpenAI audio transcription. The form must not include `model`. */
export function openaiTranscribe(form: FormData): Promise<Response> {
  const apiKey = openaiKey();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  return fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
}
