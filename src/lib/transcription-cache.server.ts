/**
 * Cache of finished transcriptions keyed by a hash of the audio. Pressing
 * "generate captions" again on the same clip then costs nothing and returns at
 * once. Every failure here (table not created yet, network) is ignored so the
 * cache can never break transcription itself.
 */
import type { TranscriptionResult } from "./transcribe.server";

/** Results older than this are not reused. */
const MAX_AGE_DAYS = 30;

export async function transcriptionCacheKey(input: {
  userId: string;
  audioBase64: string;
  language?: string;
  glossary?: string[];
}): Promise<string> {
  const glossary = [...(input.glossary ?? [])].sort().join("\u0001");
  const text = [input.userId, input.language ?? "", glossary, input.audioBase64].join("\u0000");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// The generated Database types do not know this table yet.
type CacheTable = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      gte: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { result: TranscriptionResult } | null;
          error: unknown;
        }>;
      };
    };
  };
  upsert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
};

async function table(): Promise<CacheTable> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin as unknown as { from: (name: string) => CacheTable }).from(
    "transcription_cache",
  );
}

export async function readCachedTranscription(key: string): Promise<TranscriptionResult | null> {
  try {
    const since = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();
    const { data, error } = await (
      await table()
    )
      .select("result")
      .eq("key", key)
      .gte("created_at", since)
      .maybeSingle();
    if (error || !data?.result?.text) return null;
    return data.result;
  } catch {
    return null;
  }
}

export async function writeCachedTranscription(
  key: string,
  userId: string,
  result: TranscriptionResult,
): Promise<void> {
  // A result produced while an engine was failing may be worse than a retry.
  if (!result.text || result.warnings?.length) return;
  try {
    const { error } = await (
      await table()
    ).upsert({
      key,
      user_id: userId,
      result,
      created_at: new Date().toISOString(),
    });
    if (error) console.warn("[transcription-cache] write skipped:", String(error).slice(0, 200));
  } catch {
    /* cache is best-effort */
  }
}
