import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    audioBase64: z.string().min(100),
    language: z.enum(["th", "lo", "en"]).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const binary = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([binary], { type: "audio/wav" }), "recording.wav");
    form.append("temperature", "0");
    // The transcription provider does not accept `lo` in its `language` field.
    // Guide Lao recognition through the prompt instead, as recommended by the
    // provider, while retaining its supported ISO codes for Thai and English.
    if (data.language === "lo") {
      form.append(
        "prompt",
        [
          "ພາສາລາວ. The speaker talks in Lao (ພາສາລາວ), not Thai.",
          "Transcribe verbatim in Lao script (ຕົວອັກສອນລາວ) exactly as spoken.",
          "Never translate, never transliterate into Thai script, never summarise.",
          "If a short part is unclear, write only what is clearly audible and nothing else.",
        ].join(" "),
      );
    } else if (data.language) {
      form.append("language", data.language);
      if (data.language === "th") {
        form.append(
          "prompt",
          "ถอดเสียงภาษาไทยตามที่พูดจริงแบบคำต่อคำ ห้ามแปล ห้ามสรุป และห้ามเติมข้อความที่ไม่ได้พูด",
        );
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
    let text = (json.text ?? "").trim();

    // Drop the provider's well-known hallucinations on near-silent audio.
    const HALLUCINATIONS = [
      "thank you", "thanks for watching", "you", "bye", "subtitles by",
      "ขอบคุณค่ะ", "ขอบคุณครับ", "ขอบคุณที่รับชม", "ຂອບໃຈ",
    ];
    const normalized = text.toLowerCase().replace(/[.!?。！？\s]+$/g, "").trim();
    if (HALLUCINATIONS.includes(normalized)) text = "";

    // For Lao requests, reject output that came back in Thai script instead.
    if (data.language === "lo" && text) {
      const lao = (text.match(/[\u0e80-\u0eff]/g) ?? []).length;
      const thai = (text.match(/[\u0e00-\u0e7f]/g) ?? []).length;
      if (thai > lao * 1.5) text = "";
    }

    return { text };
  });
