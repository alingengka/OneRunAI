import { thaiToLaoScript } from "./lao-script";
import { tokenizeWords } from "./captions";

const HALLUCINATIONS = new Set([
  "thank you", "thanks for watching", "you", "bye", "subtitles by",
  "ขอบคุณค่ะ", "ขอบคุณครับ", "ขอบคุณที่รับชม", "ຂອບໃຈ",
]);

/** Word-level timing measured by the recogniser itself (seconds, clip-local). */
export type TimedWord = { text: string; start: number; end: number };

export type TranscriptionResult = {
  text: string;
  alternatives: string[];
  agreement: number;
  /** Real word timings from ElevenLabs Scribe, present whenever Scribe answered. */
  words?: TimedWord[];
  wordSource?: "scribe" | null;
};

function laoPrompt(context: string, glossary: string[], strict: boolean): string {
  const base = [
    "ພາສາລາວ. ຖອດສຽງແບບຄຳຕໍ່ຄຳເປັນອັກສອນລາວ.",
    "The speaker is speaking Lao, not Thai. Transcribe verbatim in Lao script exactly as spoken.",
    "Never translate, never use Thai script, never summarise, and never invent missing speech.",
    "Use standard Vientiane/Central Lao spelling. Preserve tone marks, repeated words, names, numbers and spoken particles.",
    // Lao speakers code-switch constantly; spelling English words out in Lao
    // letters loses the real wording, so keep them in Latin script.
    "Lao speakers often mix English words into a Lao sentence. Write any English word that is actually spoken in Latin letters exactly as said (e.g. appreciate, the best thing, edit, video, viral) — never transliterate it into Lao script and never drop it.",
    "Return transcript text only without labels or commentary.",
  ];
  if (strict) base.push("Apart from spoken English words, use only Lao characters (U+0E80–U+0EFF), digits, spaces and spoken punctuation.");
  if (glossary.length) base.push(`Preferred spellings when audible: ${glossary.slice(0, 40).join(", ")}`);
  if (context && !strict) base.push(`Context before this audio, for spelling continuity only: ${context.slice(-500)}`);
  if (strict) base.push("Listen independently from prior context and prefer only words clearly audible in this recording.");
  return base.join(" ");
}

const LATIN_WORD = /[A-Za-z][A-Za-z'’-]*/g;

/** Latin-script words in a candidate — spoken English kept as English. */
function latinWords(text: string): string[] {
  return (text.match(LATIN_WORD) ?? []).map((word) => word.toLowerCase());
}

function cleanup(text: string, language?: string): string {
  const out = text.trim().replace(/^```[^\n]*\n?|```$/g, "").trim();
  const normalized = out.toLowerCase().replace(/[.!?。！？\s]+$/g, "").trim();
  if (HALLUCINATIONS.has(normalized)) return "";
  if (language === "lo" && out) {
    const lao = (out.match(/[\u0e80-\u0eff]/g) ?? []).length;
    const thai = (out.match(/[\u0e00-\u0e7f]/g) ?? []).length;
    // Code-switched speech can be entirely English in a short chunk, so Latin
    // text counts as valid output; only Thai script means a wrong rendering.
    if ((!lao && !latinWords(out).length) || thai > Math.max(1, lao * 0.08)) return "";
  }
  return out;
}


function chars(text: string): string[] {
  return [...text.normalize("NFC").replace(/[\s.,!?]/g, "")];
}

function similarity(a: string, b: string): number {
  const x = chars(a);
  const y = chars(b);
  if (!x.length || !y.length) return 0;
  const row = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, diagonal + (x[i - 1] === y[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return Math.max(0, 1 - (row[y.length] ?? Math.max(x.length, y.length)) / Math.max(x.length, y.length));
}

function scoreCandidate(candidate: string, others: string[], language?: string, bestLatin = 0): number {
  const agreement = others.length ? others.reduce((sum, value) => sum + similarity(candidate, value), 0) / others.length : 0.72;
  if (language !== "lo") return agreement;
  // Latin letters are legitimate code-switched English, so they are neither
  // rewarded nor punished: purity only measures Lao vs. other non-Latin script.
  const symbols = [...candidate].filter((char) => !/\s/.test(char) && !/[A-Za-z0-9'’\-.,!?]/.test(char));
  const lao = symbols.filter((char) => /[\u0e80-\u0eff]/.test(char)).length;
  const scriptPurity = symbols.length ? lao / symbols.length : 1;
  // Prefer the candidate that kept the spoken English words instead of
  // transliterating or dropping them.
  const codeSwitch = bestLatin ? Math.min(1, latinWords(candidate).length / bestLatin) : 1;
  return agreement * 0.62 + scriptPurity * 0.24 + codeSwitch * 0.14;
}


/**
 * ElevenLabs Scribe recognises Lao speech far better than the OpenAI model, but
 * verified live responses come back rendered in Thai script even with
 * language_code=lao, so the text is transliterated back into Lao script.
 */
async function transcribeWithScribe(
  binary: Uint8Array<ArrayBuffer>,
  glossary: string[],
): Promise<{ text: string; transliterated: boolean; timing: TimedWord[] }> {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) throw new Error("ElevenLabs is not connected to this project");
  const form = new FormData();
  form.append("file", new Blob([binary], { type: "audio/wav" }), "recording.wav");
  form.append("model_id", "scribe_v2");
  form.append("language_code", "lao");
  form.append("diarize", "false");
  form.append("tag_audio_events", "false");
  if (glossary.length) form.append("biased_keywords", JSON.stringify(glossary.slice(0, 40)));

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs transcription failed [${response.status}]: ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    text?: string;
    words?: { text?: string; start?: number; end?: number; type?: string }[];
  };
  const raw = (payload.text ?? "").trim();
  if (!raw) return { text: "", transliterated: false, timing: [] };
  const lao = (raw.match(/[\u0e80-\u0eff]/g) ?? []).length;
  const thai = (raw.match(/[\u0e00-\u0e7f]/g) ?? []).length;
  const transliterated = lao < thai;
  return {
    text: transliterated ? thaiToLaoScript(raw) : raw,
    transliterated,
    timing: buildScribeTiming(payload.words ?? [], transliterated),
  };
}

/**
 * Scribe returns character/syllable level tokens. Rebuild the recognised string
 * with a char -> token map, cut it into words with the same tokenizer the rest
 * of the app uses, then take each word's start from its first token and end
 * from its last one. Transliteration happens per word (never per character) so
 * Thai->Lao syllable rules still apply.
 */
export function buildScribeTiming(
  tokens: { text?: string; start?: number; end?: number; type?: string }[],
  transliterated: boolean,
): TimedWord[] {
  const owners: { start: number; end: number }[] = [];
  let text = "";
  for (const token of tokens) {
    if (token.type === "audio_event") continue;
    const value = token.text ?? "";
    if (!value) continue;
    const start = Number.isFinite(token.start) ? Number(token.start) : owners[owners.length - 1]?.end ?? 0;
    const end = Number.isFinite(token.end) ? Number(token.end) : start;
    for (const _character of value) owners.push({ start, end });
    text += value;
  }
  if (!text.trim()) return [];

  const words: TimedWord[] = [];
  let cursor = 0;
  for (const word of tokenizeWords(text)) {
    const index = text.indexOf(word, cursor);
    if (index < 0) continue;
    cursor = index + word.length;
    const first = owners[index];
    const last = owners[cursor - 1];
    if (!first || !last) continue;
    const value = transliterated ? thaiToLaoScript(word) : word;
    if (!value.trim()) continue;
    words.push({ text: value, start: first.start, end: Math.max(last.end, first.start + 0.03) });
  }
  return words;
}

/**
 * Gemini is multimodal on /v1/chat/completions and, verified live, emits Lao
 * script directly, so it needs no Thai->Lao transliteration pass.
 */
async function transcribeWithGemini(
  audioBase64: string,
  apiKey: string,
  context: string,
  glossary: string[],
): Promise<string> {
  const instructions = [
    "This recording is spoken Lao (Vientiane / Central Lao), not Thai.",
    "Transcribe it verbatim in Lao script (U+0E80–U+0EFF) exactly as spoken.",
    "Never translate, never use Thai script, never summarise, never invent speech that is not audible.",
    "Preserve tone marks, repeated words, names, numbers and spoken particles.",
    "Return the transcript text only, with no labels, quotes or commentary.",
  ];
  if (glossary.length) instructions.push(`Preferred spellings when audible: ${glossary.slice(0, 40).join(", ")}`);
  if (context) instructions.push(`Context before this audio, for spelling continuity only: ${context.slice(-500)}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: instructions.join(" ") },
          { type: "input_audio", input_audio: { data: audioBase64, format: "wav" } },
        ],
      }],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini transcription failed [${response.status}]: ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return (payload.choices?.[0]?.message?.content ?? "").trim();
}

export async function transcribeAudioServer(input: {
  audioBase64: string;
  language?: "th" | "lo" | "en";
  context?: string;
  glossary?: string[];
}): Promise<TranscriptionResult> {
  // Read lazily: Lao can complete on ElevenLabs alone if the gateway key is absent.
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey && input.language !== "lo") throw new Error("Missing LOVABLE_API_KEY");

  const binary = Uint8Array.from(atob(input.audioBase64), (character) => character.charCodeAt(0));
  const attempts = input.language === "lo" ? [0, 0] : [0];
  const alternatives: string[] = [];
  const transliterated = new Set<string>();
  let scribeTiming: TimedWord[] = [];
  let lastError: Error | null = null;

  if (input.language === "lo") {
    const [scribeResult, geminiResult] = await Promise.allSettled([
      transcribeWithScribe(binary, input.glossary ?? []),
      apiKey
        ? transcribeWithGemini(input.audioBase64, apiKey, input.context ?? "", input.glossary ?? [])
        : Promise.reject(new Error("Missing LOVABLE_API_KEY")),
    ]);

    if (scribeResult.status === "fulfilled") {
      // Keep Scribe's measured timeline even when another engine wins the text.
      scribeTiming = scribeResult.value.timing;
      const text = cleanup(scribeResult.value.text, "lo");
      if (text) {
        alternatives.push(text);
        if (scribeResult.value.transliterated) transliterated.add(text);
      }
    } else {
      lastError = scribeResult.reason instanceof Error ? scribeResult.reason : new Error("ElevenLabs transcription failed");
    }

    if (geminiResult.status === "fulfilled") {
      const text = cleanup(geminiResult.value, "lo");
      if (text && !alternatives.includes(text)) alternatives.push(text);
    } else if (apiKey) {
      lastError = geminiResult.reason instanceof Error ? geminiResult.reason : new Error("Gemini transcription failed");
    }
  }




  for (let index = 0; index < attempts.length && apiKey; index++) {
    const form = new FormData();

    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([binary], { type: "audio/wav" }), "recording.wav");
    form.append("temperature", String(attempts[index]));
    if (input.language === "lo") form.append("prompt", laoPrompt(input.context ?? "", input.glossary ?? [], index > 0));
    else if (input.language) {
      form.append("language", input.language);
      if (input.context) form.append("prompt", `Continue without repeating: ${input.context.slice(-500)}`);
    }

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(`Transcription failed [${response.status}]: ${body.slice(0, 300)}`);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
        continue;
      }
      const payload = (await response.json()) as { text?: string };
      const text = cleanup(payload.text ?? "", input.language);
      if (text && !alternatives.includes(text)) alternatives.push(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Transcription failed");
      if (alternatives.length === 0) throw lastError;
      break;
    }
  }

  if (!alternatives.length) {
    if (lastError) throw lastError;
    return { text: "", alternatives: [], agreement: 0, words: scribeTiming, wordSource: scribeTiming.length ? "scribe" : null };
  }
  const ranked = alternatives
    .map((text) => ({
      text,
      // Thai->Lao transliteration (Scribe) is lossy, so such a candidate only
      // wins when it is clearly better than a natively Lao-script candidate.
      score: scoreCandidate(text, alternatives.filter((value) => value !== text), input.language)
        - (transliterated.has(text) ? 0.03 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    text: ranked[0]?.text ?? "",
    alternatives,
    agreement: ranked[0]?.score ?? 0,
    words: scribeTiming,
    wordSource: scribeTiming.length ? "scribe" : null,
  };
}
