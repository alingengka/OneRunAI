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
    // The transcription provider does not accept `lo` in its `language` field.
    // Guide Lao recognition through the prompt instead, as recommended by the
    // provider, while retaining its supported ISO codes for Thai and English.
    if (data.language === "lo") {
      form.append(
        "prompt",
        "The audio is spoken in Lao. Transcribe it accurately in the Lao script and preserve the speaker's original wording.",
      );
    } else if (data.language) {
      form.append("language", data.language);
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
    return { text: json.text ?? "" };
  });
