import { createFileRoute } from "@tanstack/react-router";
import { CaptionOverlay } from "@/components/editor/CaptionOverlay";
import { baseStyle, type CaptionGroup } from "@/lib/captions";

export const Route = createFileRoute("/test-bold")({
  component: TestBold,
});

const TEST_TEXTS: Record<string, string> = {
  lo: "ເບິ່ງນີ້ເລີຍ ຫ້າມພາດ",
  th: "ดูนี่เลย ห้ามพลาด",
  en: "Watch this now",
};

const FONTS: [string, string, string][] = [
  ["Archivo Black", "'Archivo Black', system-ui, sans-serif", "lo"],
  ["Inter", "'Inter', system-ui, sans-serif", "en"],
  ["Kanit", "'Kanit', 'Noto Sans Thai', sans-serif", "th"],
  ["Lao Chalk", "'Lao Chalk', 'Noto Sans Lao', sans-serif", "lo"],
  ["PB Champasak", "'PB Champasak', 'Noto Sans Lao', sans-serif", "lo"],
  ["Tiktok Lao", "'Tiktok Lao', 'Noto Sans Lao', sans-serif", "lo"],
  ["Touk2", "'Touk2', 'Noto Sans Lao', sans-serif", "lo"],
  ["Hinsiew", "'Hinsiew', 'Noto Sans Lao', sans-serif", "lo"],
  ["Lao Handwriting 16", "'Lao Handwriting 16', 'Noto Sans Lao', sans-serif", "lo"],
  ["PB Melon", "'PB Melon', 'Noto Sans Lao', sans-serif", "lo"],
];

function makeGroup(text: string): CaptionGroup {
  const words = text.split(/\s+/).map((t, i) => ({ text: t, start: i * 0.5, end: (i + 1) * 0.5 }));
  return { start: 0, end: words.length * 0.5, words };
}

function makeStyle(fontFamily: string, bold: boolean, italic: boolean) {
  return { ...baseStyle, fontFamily, fontWeight: 400, bold, italic, animation: "none" as const, highlight: "none" as const, stroke: "medium" as const, color: "#000000", strokeColor: "#000000", shadow: "none" as const };
}

function TestBold() {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-6">
      <h1 className="mb-4 text-lg font-bold">Bold preview test</h1>
      {FONTS.map(([label, fontFamily, lang]) => {
        const text = TEST_TEXTS[lang];
        const group = makeGroup(text);
        return (
          <div key={label} className="relative mb-6 h-44 border border-dashed border-gray-300">
            <span className="absolute left-2 top-2 text-xs text-gray-500">{label}</span>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />
            <CaptionOverlay group={group} time={10} style={makeStyle(fontFamily, false, false)} height={176} />
            <span className="absolute right-2 top-2 text-xs text-gray-500">plain</span>
            <CaptionOverlay group={group} time={10} style={makeStyle(fontFamily, true, false)} height={176} />
            <span className="absolute right-[52%] top-2 text-xs text-gray-500">bold</span>
          </div>
        );
      })}
    </div>
  );
}
