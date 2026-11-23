/**
 * Runs the Claude connector's subtitle pipeline on a WAV file with the real
 * AI engines, in rounds as the connector does, and prints the SRT.
 *   bun scripts/connector-pipeline-check.ts tests/fixtures/lao-sample.wav [lo|th|en]
 */
import { readFileSync } from "node:fs";
import { parseWav } from "../src/lib/api/wav";
import {
  jobProgress,
  jobResult,
  planJob,
  runRound,
  type Language,
} from "../src/lib/api/subtitle-pipeline";
import { transcribeAudioServer } from "../src/lib/transcribe.server";

const file = process.argv[2] ?? "tests/fixtures/lao-sample.wav";
const language = (process.argv[3] ?? "lo") as Language;
const roundMs = Number(process.env["ROUND_MS"] ?? 20_000);
const buffer = parseWav(new Uint8Array(readFileSync(file)));
const state = planJob(buffer, language, []);
console.log(`${buffer.duration.toFixed(1)} s, ${state.chunks.length} chunks`);
let rounds = 0;
const started = Date.now();
while (!state.done) {
  rounds++;
  await runRound(buffer, state, {
    transcribe: (input) => transcribeAudioServer(input),
    deadline: Date.now() + roundMs,
  });
  // the state is saved as JSON between rounds
  Object.assign(state, JSON.parse(JSON.stringify(state)));
  const p = jobProgress(state);
  console.log(`round ${rounds}: ${p.done}/${p.total}`);
}
const result = jobResult(state);
console.log(
  `done in ${((Date.now() - started) / 1000).toFixed(1)} s, failed: ${JSON.stringify(result.failed)}`,
);
console.log(result.srt);
