/**
 * What a Gemini 429 says: how long Google asks us to wait, and whether the
 * per-minute limit was hit (passes in seconds) or a daily quota (lasts hours).
 */
export function readRateLimit(
  body: string,
  retryAfterHeader: string | null,
): { waitMs: number | null; daily: boolean } {
  const daily = /per\s*day|PerDay|daily/i.test(body);
  let seconds: number | null = null;
  const header = Number(retryAfterHeader);
  if (Number.isFinite(header) && header > 0) seconds = header;
  // "retryDelay": "17s"  or  "Please retry in 17.29s"
  const fromBody =
    /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body)?.[1] ??
    /retry in (\d+(?:\.\d+)?)\s*s/i.exec(body)?.[1];
  if (seconds == null && fromBody) seconds = Number(fromBody);
  return { waitMs: seconds != null && Number.isFinite(seconds) ? seconds * 1000 : null, daily };
}
