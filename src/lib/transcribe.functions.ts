import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HALLUCINATIONS = [
  "thank you", "thanks for watching", "you", "bye", "subtitles by",
  "ขอบคุณค่ะ", "ขอบคุณครับ", "ขอบคุณที่รับชม", "ຂອບໃຈ",
];

function laoPrompt(context: string, strict: boolean): string {
  const base = [
    "ພາສາລາວ. ຖອດຂໍ້ຄວາມເປັນຕົວອັກສອນລາວ.",
    "The speaker talks in Lao (ພາສາລາວ), not Thai.",
    "Transcribe verbatim in Lao script (ຕົວອັກສອນລາວ) exactly as spoken.",
    "Never translate, never transliterate into Thai script, never summarise.",
    "Keep Lao spelling conventions (ໆ, ຯ, ວັນນະຍຸດ) and do not add punctuation that was not spoken.",
    "If a short part is unclear, write only what is clearly audible and nothing else.",
  ];
  if (strict) {
    base.push("Output ONLY Lao characters (U+0E80–U+0EFF), digits and spaces. Any Thai character is wrong.");
  }
  if (context) base.push(`Continuation of this Lao transcript: "${context.slice(-320)}"`);
  return base.join(" ");
}

function cleanup(text: string, language?: string): string {
  let out = text.trim();
  const normalized = out.toLowerCase().replace(/[.!?。！？\s]+$/g, "").trim();
  if (HALLUCINATIONS.includes(normalized)) return "";
  if (language === "lo" && out) {
    const lao = (out.match(/[\u0e80-\u0eff]/g) ?? []).length;
    const thai = (out.match(/[\u0e00-\u0e7f]/g) ?? []).length;
    if (thai > lao) return "";
  }
  return out;
}

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    audioBase64: z.string().min(100),
    language: z.enum(["th", "lo", "en"]).optional(),
    context: z.string().max(2000).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const binary = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const context = (data.context ?? "").trim();

    const run = async (attempt: number): Promise<string> => {
      const form = new FormData();
      form.append("model", "openai/gpt-4o-transcribe");
      form.append("file", new Blob([binary], { type: "audio/wav" }), "recording.wav");
      form.append("temperature", attempt === 0 ? "0" : "0.2");

      if (data.language === "lo") {
        // The provider does not accept `lo` in its `language` field; steer it
        // with a Lao-script prompt (plus the running transcript for context).
        form.append("prompt", laoPrompt(context, attempt > 0));
      } else if (data.language) {
        form.append("language", data.language);
        if (data.language === "th") {
          form.append(
            "prompt",
            [
              "ถอดเสียงภาษาไทยตามที่พูดจริงแบบคำต่อคำ ห้ามแปล ห้ามสรุป และห้ามเติมข้อความที่ไม่ได้พูด",
              context ? `ต่อเนื่องจากข้อความก่อนหน้า: "${context.slice(-320)}"` : "",
            ].join(" ").trim(),
          );
        } else if (context) {
          form.append("prompt", `Continuation of: "${context.slice(-320)}"`);
        }
      }

      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Transcription failed [${res.status}]: ${body.slice(0, 300)}`);
      }

      const json = (await res.json()) as { text?: string };
      return cleanup(json.text ?? "", data.language);
    };

    let text = await run(0);
    // A rejected (Thai-script / hallucinated) Lao result is worth one stricter retry
    // instead of silently dropping the whole phrase from the subtitle track.
    if (!text && data.language === "lo") text = await run(1);

    return { text };
  });

