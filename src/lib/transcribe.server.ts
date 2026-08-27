import { thaiToLaoScript } from "./lao-script";

const HALLUCINATIONS = new Set([
  "thank you", "thanks for watching", "you", "bye", "subtitles by",
  "ขอบคุณค่ะ", "ขอบคุณครับ", "ขอบคุณที่รับชม", "ຂອບໃຈ",
]);

export type TranscriptionResult = {
  text: string;
  alternatives: string[];
  agreement: number;
};

function laoPrompt(context: string, glossary: string[], strict: boolean): string {
  const base = [
    "ພາສາລາວ. ຖອດສຽງແບບຄຳຕໍ່ຄຳເປັນອັກສອນລາວ.",
    "The speaker is speaking Lao, not Thai. Transcribe verbatim in Lao script exactly as spoken.",
    "Never translate, never use Thai script, never summarise, and never invent missing speech.",
    "Use standard Vientiane/Central Lao spelling. Preserve tone marks, repeated words, names, numbers and spoken particles.",
    "Return transcript text only without labels or commentary.",
  ];
  if (strict) base.push("Use only Lao characters (U+0E80–U+0EFF), digits, spaces and spoken punctuation.");
  if (glossary.length) base.push(`Preferred spellings when audible: ${glossary.slice(0, 40).join(", ")}`);
  if (context && !strict) base.push(`Context before this audio, for spelling continuity only: ${context.slice(-500)}`);
  if (strict) base.push("Listen independently from prior context and prefer only words clearly audible in this recording.");
  return base.join(" ");
}

function cleanup(text: string, language?: string): string {
  const out = text.trim().replace(/^```[^\n]*\n?|```$/g, "").trim();
  const normalized = out.toLowerCase().replace(/[.!?。！？\s]+$/g, "").trim();
  if (HALLUCINATIONS.has(normalized)) return "";
  if (language === "lo" && out) {
    const lao = (out.match(/[\u0e80-\u0eff]/g) ?? []).length;
    const thai = (out.match(/[\u0e00-\u0e7f]/g) ?? []).length;
    if (!lao || thai > Math.max(1, lao * 0.08)) return "";
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

function scoreCandidate(candidate: string, others: string[], language?: string): number {
  const agreement = others.length ? others.reduce((sum, value) => sum + similarity(candidate, value), 0) / others.length : 0.72;
  if (language !== "lo") return agreement;
  const symbols = [...candidate].filter((char) => !/\s/.test(char));
  const lao = symbols.filter((char) => /[\u0e80-\u0eff]/.test(char)).length;
  const scriptPurity = symbols.length ? lao / symbols.length : 0;
  return agreement * 0.72 + scriptPurity * 0.28;
}

/**
 * ElevenLabs Scribe recognises Lao speech far better than the OpenAI model, but
 * verified live responses come back rendered in Thai script even with
 * language_code=lao, so the text is transliterated back into Lao script.
 */
async function transcribeWithScribe(binary: Uint8Array<ArrayBuffer>, glossary: string[]): Promise<{ text: string; transliterated: boolean }> {
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
  const payload = (await response.json()) as { text?: string };
  const raw = (payload.text ?? "").trim();
  if (!raw) return { text: "", transliterated: false };
  const lao = (raw.match(/[\u0e80-\u0eff]/g) ?? []).length;
  const thai = (raw.match(/[\u0e00-\u0e7f]/g) ?? []).length;
  if (lao >= thai) return { text: raw, transliterated: false };
  return { text: thaiToLaoScript(raw), transliterated: true };
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
  let lastError: Error | null = null;

  if (input.language === "lo") {
    const [scribeResult, geminiResult] = await Promise.allSettled([
      transcribeWithScribe(binary, input.glossary ?? []),
      apiKey
        ? transcribeWithGemini(input.audioBase64, apiKey, input.context ?? "", input.glossary ?? [])
        : Promise.reject(new Error("Missing LOVABLE_API_KEY")),
    ]);

    if (scribeResult.status === "fulfilled") {
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
    return { text: "", alternatives: [], agreement: 0 };
  }
  const ranked = alternatives
    .map((text, index) => ({
      text,
      // The Scribe candidate is first and went through Thai->Lao transliteration,
      // which is lossy, so it only wins when it is clearly the better transcript.
      score: scoreCandidate(text, alternatives.filter((value) => value !== text), input.language)
        - (input.language === "lo" && index === 0 && transliterated ? 0.03 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return { text: ranked[0]?.text ?? "", alternatives, agreement: ranked[0]?.score ?? 0 };
}
