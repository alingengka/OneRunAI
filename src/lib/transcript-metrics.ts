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

export function wordErrorRate(reference: string, hypothesis: string): number {
  const expected = reference.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const actual = hypothesis.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  return expected.length ? editDistance(expected, actual) / expected.length : Number(actual.length > 0);
}