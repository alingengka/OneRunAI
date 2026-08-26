import type { Word } from "./captions";

/** กฎแทนคำเฉพาะ: เมื่อโมเดลถอดผิดซ้ำๆ ระบบจะแก้ให้อัตโนมัติ */
export type LexRule = {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
  hits: number;
};

export function parseGlossaryTerms(glossary: string, limit = 40): string[] {
  return glossary
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function makeRule(from: string, to: string): LexRule {
  return {
    id: `${from}→${to}`.toLowerCase(),
    from: from.trim(),
    to: to.trim(),
    enabled: true,
    hits: 0,
  };
}

export function upsertRule(rules: LexRule[], rule: LexRule): LexRule[] {
  if (!rule.from || !rule.to || rule.from === rule.to) return rules;
  const existing = rules.find((item) => item.id === rule.id);
  if (existing) return rules.map((item) => (item.id === rule.id ? { ...item, ...rule, hits: item.hits } : item));
  return [...rules, rule];
}

export function removeRule(rules: LexRule[], id: string): LexRule[] {
  return rules.filter((rule) => rule.id !== id);
}

export function toggleRule(rules: LexRule[], id: string): LexRule[] {
  return rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
}

function applyToText(text: string, rules: LexRule[]): { text: string; applied: string[] } {
  let out = text;
  const applied: string[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !rule.from) continue;
    if (!out.includes(rule.from)) continue;
    out = out.split(rule.from).join(rule.to);
    applied.push(rule.id);
  }
  return { text: out, applied };
}

/** ใช้กฎกับข้อความดิบที่เพิ่งถอดเสียงเสร็จ */
export function applyRulesToText(text: string, rules: LexRule[]): string {
  return applyToText(text, rules).text;
}

/** ใช้กฎกับคำที่มีเวลาแล้ว พร้อมนับจำนวนครั้งที่กฎถูกใช้ */
export function applyRulesToWords(
  words: Word[],
  rules: LexRule[],
): { words: Word[]; rules: LexRule[]; changed: number } {
  const counts = new Map<string, number>();
  let changed = 0;
  const next = words.map((word) => {
    const { text, applied } = applyToText(word.text, rules);
    if (text === word.text) return word;
    changed++;
    applied.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    return { ...word, text };
  });
  return {
    words: next,
    rules: rules.map((rule) => (counts.has(rule.id) ? { ...rule, hits: rule.hits + (counts.get(rule.id) ?? 0) } : rule)),
    changed,
  };
}
