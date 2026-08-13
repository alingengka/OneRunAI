import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  audioBase64: z.string().min(100),
  language: z.string().max(5).optional(),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const binary = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([binary], { type: "audio/wav" }), "recording.wav");
    if (data.language) form.append("language", data.language);

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
