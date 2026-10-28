import { readRateLimit } from "./gemini-limits";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const minute = `{"error":{"code":429,"message":"You exceeded your current quota. Please retry in 17.29s.","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"17s"}]}}`;
const day = `{"error":{"code":429,"message":"You exceeded your current quota.","details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]},{"retryDelay":"36s"}]}}`;

const m = readRateLimit(minute, null);
assert(m.waitMs === 17000 && !m.daily, `per-minute: ${JSON.stringify(m)}`);
const d = readRateLimit(day, null);
assert(d.daily, `per-day: ${JSON.stringify(d)}`);
assert(readRateLimit("", "5").waitMs === 5000, "retry-after header wins");
assert(readRateLimit("Please retry in 2.5s", null).waitMs === 2500, "message delay");
assert(readRateLimit("quota exceeded", null).waitMs === null, "no delay given");

console.log("gemini-limits tests passed");
