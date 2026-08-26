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
    "Preserve Lao spelling, tone marks, repeated words, names, numbers and spoken particles.",
    "Return transcript text only without labels or commentary.",
  ];
  if (strict) base.push("Use only Lao characters (U+0E80–U+0EFF), digits, spaces and spoken punctuation.");
  if (glossary.length) base.push(`Preferred spellings when audible: ${glossary.slice(0, 40).join(", ")}`);
  if (context) base.push(`Previous Lao context (do not repeat it): ${context.slice(-500)}`);
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

export async function transcribeAudioServer(input: {
  audioBase64: string;
  language?: "th" | "lo" | "en";
  context?: string;
  glossary?: string[];
}): Promise<TranscriptionResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const binary = Uint8Array.from(atob(input.audioBase64), (character) => character.charCodeAt(0));
  const attempts = input.language === "lo" ? [0, 0.15] : [0];
  const alternatives: string[] = [];

  for (let index = 0; index < attempts.length; index++) {
    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([binary], { type: "audio/wav" }), "recording.wav");
    form.append("temperature", String(attempts[index]));
    if (input.language === "lo") form.append("prompt", laoPrompt(input.context ?? "", input.glossary ?? [], index > 0));
    else if (input.language) {
      form.append("language", input.language);
      if (input.context) form.append("prompt", `Continue without repeating: ${input.context.slice(-500)}`);
    }
    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Transcription failed [${response.status}]: ${body.slice(0, 300)}`);
    }
    const payload = (await response.json()) as { text?: string };
    const text = cleanup(payload.text ?? "", input.language);
    if (text && !alternatives.includes(text)) alternatives.push(text);
  }

  if (!alternatives.length) return { text: "", alternatives: [], agreement: 0 };
  const ranked = alternatives
    .map((text) => ({ text, score: scoreCandidate(text, alternatives.filter((value) => value !== text), input.language) }))
    .sort((a, b) => b.score - a.score);
  return { text: ranked[0]?.text ?? "", alternatives, agreement: ranked[0]?.score ?? 0 };
}