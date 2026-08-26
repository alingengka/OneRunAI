import { characterErrorRate, editDistance, wordErrorRate } from "./transcript-metrics";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(editDistance(["a", "b"], ["a", "c"]) === 1, "edit distance substitution failed");
assert(characterErrorRate("ສະບາຍດີ", "ສະບາຍດີ") === 0, "Lao CER exact match failed");
assert(wordErrorRate("ສະບາຍດີ ທຸກຄົນ", "ສະບາຍດີ ທຸກຄົນ") === 0, "Lao WER exact match failed");