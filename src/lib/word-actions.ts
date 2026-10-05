/**
 * Word edits shared by the caption list (desktop popover) and the phone word
 * toolbar, so both behave the same.
 */
import { LINE_BREAK, type Word } from "./captions";
import { normalizeWordTimes } from "./caption-editing";

export function editWordAt(words: Word[], index: number, patch: Partial<Word>, duration: number) {
  return normalizeWordTimes(
    words.map((word, i) => (i === index ? { ...word, ...patch } : word)),
    duration,
  );
}

export function insertWordAfter(words: Word[], index: number, word: Word, duration: number) {
  return normalizeWordTimes(
    [...words.slice(0, index + 1), word, ...words.slice(index + 1)],
    duration,
  );
}

export function removeWordAt(words: Word[], index: number) {
  return words.filter((_, i) => i !== index);
}

/** A line break right after the word. */
export function lineBreakAfter(words: Word[], index: number, duration: number) {
  const word = words[index];
  if (!word) return words;
  return insertWordAfter(
    words,
    index,
    { text: LINE_BREAK, start: word.end, end: word.end },
    duration,
  );
}

/** A placeholder word after this one, in the gap before the next word. */
export function newWordAfter(words: Word[], index: number, duration: number, text = "คำใหม่") {
  const word = words[index];
  if (!word) return words;
  const next = words[index + 1];
  const end = Math.min(next ? next.start : duration, word.end + 0.4);
  return insertWordAfter(
    words,
    index,
    { text, start: word.end, end: Math.max(end, word.end + 0.06) },
    duration,
  );
}

/**
 * Drops a word at a new time, anywhere in the clip. It is moved to its place
 * in time order, and the neighbours it lands on are trimmed so nothing
 * overlaps (each keeps at least a sliver of time).
 */
export function moveWordTo(
  words: Word[],
  index: number,
  start: number,
  end: number,
  duration: number,
) {
  const word = words[index];
  if (!word) return words;
  const moved = { ...word, start, end };
  const rest = words.filter((_, i) => i !== index).map((w) => ({ ...w }));
  let at = rest.findIndex((w) => w.text !== LINE_BREAK && w.start >= start);
  if (at < 0) at = rest.length;
  rest.splice(at, 0, moved);
  for (let i = at - 1; i >= 0; i--) {
    const prev = rest[i]!;
    if (prev.text === LINE_BREAK) continue;
    if (prev.end > start) prev.end = Math.max(prev.start + 0.06, start);
    break;
  }
  for (let i = at + 1; i < rest.length; i++) {
    const next = rest[i]!;
    if (next.text === LINE_BREAK) continue;
    if (next.start < end) next.start = Math.min(next.end - 0.06, end);
    break;
  }
  return normalizeWordTimes(rest, duration);
}
