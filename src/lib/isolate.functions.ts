import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Cleans one chunk of the clip's speech with ElevenLabs (charged as AI seconds). */
export const isolateVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        // Hosting caps request bodies (~4.5 MB on Vercel); editor chunks are far smaller.
        audioBase64: z.string().min(100).max(4_000_000, "ไฟล์เสียงช่วงนี้ยาวเกินไป"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { isolateVoiceServer, voiceIsolationAvailable } = await import("./isolate.server");
    if (!voiceIsolationAvailable()) return { unavailable: true as const };
    const { reserveAiSeconds, wavSecondsFromBase64 } = await import("./account.server");
    const refund = await reserveAiSeconds(
      context.userId,
      wavSecondsFromBase64(data.audioBase64),
      "denoise",
    );
    try {
      return await isolateVoiceServer(data.audioBase64);
    } catch (error) {
      await refund().catch(() => undefined);
      throw error;
    }
  });
