import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  lines: z.array(z.string()).min(1).max(400),
  target: z.enum(["th", "lo", "en"]),
});

const LANG_NAME: Record<string, string> = {
  th: "Thai",
  lo: "Lao",
  en: "English",
};

export const translateLines = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              `Translate each input line into ${LANG_NAME[data.target]}. ` +
              "Return ONLY a JSON array of strings with EXACTLY the same number of items, " +
              "in the same order. Keep each translation short, spoken-style, no quotes or numbering.",
          },
          { role: "user", content: JSON.stringify(data.lines) },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Translation failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    let out: string[] = [];
    try {
      out = JSON.parse(match ? match[0] : raw) as string[];
    } catch {
      out = raw.split("\n").map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
    }
    if (!Array.isArray(out) || out.length !== data.lines.length) {
      throw new Error("Translation returned a mismatched number of lines");
    }
    return { lines: out.map((s) => String(s).trim()) };
  });
