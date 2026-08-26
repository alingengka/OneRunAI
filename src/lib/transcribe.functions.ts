import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { transcribeAudioServer } from "./transcribe.server";

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    audioBase64: z.string().min(100),
    language: z.enum(["th", "lo", "en"]).optional(),
    context: z.string().max(2000).optional(),
    glossary: z.array(z.string().min(1).max(80)).max(40).optional(),
  }).parse(data))
  .handler(async ({ data }) => transcribeAudioServer(data));

