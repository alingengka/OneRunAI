import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { transcribeAudioServer } from "./transcribe.server";

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        // Hosting caps request bodies (~4.5 MB on Vercel); editor chunks are far smaller.
        audioBase64: z.string().min(100).max(4_000_000, "ไฟล์เสียงช่วงนี้ยาวเกินไป"),
        language: z.enum(["th", "lo", "en"]).optional(),
        context: z.string().max(2000).optional(),
        glossary: z.array(z.string().min(1).max(80)).max(40).optional(),
        /** A retry asked for by the user: skip the cache and transcribe again. */
        fresh: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { readCachedTranscription, transcriptionCacheKey, writeCachedTranscription } =
      await import("./transcription-cache.server");
    const key = await transcriptionCacheKey({
      userId: context.userId,
      audioBase64: data.audioBase64,
      ...(data.language ? { language: data.language } : {}),
      ...(data.glossary ? { glossary: data.glossary } : {}),
    });
    // Same audio transcribed before: no AI call and no minutes used.
    const cached = data.fresh ? null : await readCachedTranscription(key);
    if (cached) {
      const { assertAccess } = await import("./account.server");
      await assertAccess(context.userId);
      return cached;
    }

    const { reserveAiSeconds, wavSecondsFromBase64 } = await import("./account.server");
    const refund = await reserveAiSeconds(
      context.userId,
      wavSecondsFromBase64(data.audioBase64),
      "transcribe",
    );
    try {
      const result = await transcribeAudioServer({
        audioBase64: data.audioBase64,
        ...(data.language ? { language: data.language } : {}),
        ...(data.context ? { context: data.context } : {}),
        ...(data.glossary ? { glossary: data.glossary } : {}),
      });
      await writeCachedTranscription(key, context.userId, result);
      return result;
    } catch (error) {
      await refund().catch(() => undefined);
      throw error;
    }
  });
