import { z } from "zod";

export const translateLinesInputValidator = (data: unknown) =>
  z.object({
    lines: z.array(z.string()).min(1).max(400),
    target: z.enum(["th", "lo", "en"]),
  }).parse(data);

type TranslationInput = ReturnType<typeof translateLinesInputValidator>;

const LANGUAGE_NAMES = {
  th: "Thai",
  lo: "Lao",
  en: "English",
} as const;

type TranslationItem = { id: string; text: string };

function extractJson(raw: string): unknown {
  const unfenced = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const objectStart = unfenced.indexOf("{");
    const objectEnd = unfenced.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(unfenced.slice(objectStart, objectEnd + 1));
    }
    const arrayStart = unfenced.indexOf("[");
    const arrayEnd = unfenced.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(unfenced.slice(arrayStart, arrayEnd + 1));
    }
    throw new Error("Translation returned invalid JSON");
  }
}

function readTranslations(raw: string, expected: TranslationItem[]): string[] | null {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return expected.length === 1 && raw.trim() ? [raw.trim()] : null;
  }

  const value = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as { translations?: unknown }).translations
    : parsed;

  if (!Array.isArray(value)) return null;

  if (value.every((item) => typeof item === "string")) {
    return value.length === expected.length
      ? value.map((item) => item.trim())
      : null;
  }

  const byId = new Map<string, string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { id?: unknown; text?: unknown };
    if (typeof candidate.id === "string" && typeof candidate.text === "string") {
      byId.set(candidate.id, candidate.text.trim());
    }
  }

  const ordered = expected.map((item) => byId.get(item.id));
  return ordered.every((line): line is string => typeof line === "string") ? ordered : null;
}

async function requestTranslation(
  apiKey: string,
  items: TranslationItem[],
  target: TranslationInput["target"],
): Promise<string[] | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            `Translate every item into ${LANGUAGE_NAMES[target]}. Preserve each id exactly. ` +
            "Return only JSON in this shape: {\"translations\":[{\"id\":\"line_0\",\"text\":\"translation\"}]}. " +
            "Return one item for every input item in the same order. Do not merge, split, omit, or renumber items.",
        },
        { role: "user", content: JSON.stringify({ items }) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Translation failed [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return readTranslations(payload.choices?.[0]?.message?.content ?? "", items);
}

async function translateBatch(
  apiKey: string,
  items: TranslationItem[],
  target: TranslationInput["target"],
): Promise<string[]> {
  const translated = await requestTranslation(apiKey, items, target);
  if (translated) return translated;

  if (items.length === 1) {
    throw new Error(`Translation failed for ${items[0]?.id ?? "caption"}`);
  }

  const middle = Math.ceil(items.length / 2);
  const [left, right] = await Promise.all([
    translateBatch(apiKey, items.slice(0, middle), target),
    translateBatch(apiKey, items.slice(middle), target),
  ]);
  return [...left, ...right];
}

export async function translateLinesHandler({ data }: { data: TranslationInput }) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const output = new Array<string>(data.lines.length);
  const items: TranslationItem[] = [];

  data.lines.forEach((line, index) => {
    if (!line.trim()) output[index] = "";
    else items.push({ id: `line_${index}`, text: line });
  });

  if (items.length) {
    const translated = await translateBatch(apiKey, items, data.target);
    items.forEach((item, index) => {
      const originalIndex = Number(item.id.slice("line_".length));
      output[originalIndex] = translated[index] ?? data.lines[originalIndex] ?? "";
    });
  }

  return { lines: output };
}