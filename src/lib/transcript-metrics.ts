function normalized(value: string): string[] {
  return [...value.normalize("NFC").replace(/[\s.,!?。！？]/g, "")];
}

export function editDistance<T>(reference: T[], hypothesis: T[]): number {
  const row = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let i = 1; i <= reference.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= hypothesis.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, diagonal + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[hypothesis.length] ?? reference.length;
}

export function characterErrorRate(reference: string, hypothesis: string): number {
  const expected = normalized(reference);
  return expected.length ? editDistance(expected, normalized(hypothesis)) / expected.length : Number(hypothesis.length > 0);
}

/**
 * ภาษาลาว/ไทยไม่เว้นวรรคระหว่างคำ การตัดด้วยช่องว่างจึงให้ WER ที่ไม่มีความหมาย
 * (ตัวอักษรตรงกัน 100% แต่ WER สูงเพราะเครื่องถอดเสียงเว้นวรรคไม่เหมือนกัน)
 * จึงตัดคำด้วย Intl.Segmenter แล้วค่อยเทียบ
 */
function words(value: string): string[] {
  const text = value.normalize("NFC").replace(/[.,!?。！？]/g, " ").trim();
  if (!text) return [];
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return text.split(/\s+/).filter(Boolean);
  const segmenter = new Segmenter("lo", { granularity: "word" });
  return [...segmenter.segment(text)].filter((s) => s.isWordLike).map((s) => s.segment);
}

export function wordErrorRate(reference: string, hypothesis: string): number {
  const expected = words(reference);
  const actual = words(hypothesis);
  return expected.length ? editDistance(expected, actual) / expected.length : Number(actual.length > 0);
}