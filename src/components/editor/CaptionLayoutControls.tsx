import { cn } from "@/lib/utils";
import { captionModeOf, type CaptionStyle } from "@/lib/captions";

type Props = {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
};

type Choice = { key: string; label: string; patch: Partial<CaptionStyle> };

const GROUPS: Choice[] = [
  { key: "word", label: "1 คำ", patch: { captionMode: "word" } },
  { key: "2", label: "2 คำ", patch: { captionMode: "fixed", wordsPerGroup: 2 } },
  { key: "3", label: "3 คำ", patch: { captionMode: "fixed", wordsPerGroup: 3 } },
  { key: "4", label: "4 คำ", patch: { captionMode: "fixed", wordsPerGroup: 4 } },
  { key: "sentence", label: "ทั้งประโยค", patch: { captionMode: "sentence" } },
];

const JOIN: Choice[] = [
  { key: "join", label: "ติดกัน", patch: { joinWords: true } },
  { key: "space", label: "เว้นวรรค", patch: { joinWords: false } },
];

function Segmented({
  label,
  choices,
  current,
  onPick,
}: {
  label: string;
  choices: Choice[];
  current: string;
  onPick: (choice: Choice) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-secondary p-1">
        {choices.map((choice) => {
          const on = choice.key === current;
          return (
            <button
              key={choice.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(choice)}
              className={cn(
                "h-9 min-w-0 flex-1 rounded-md px-2 text-sm whitespace-nowrap transition-colors",
                on
                  ? "bg-background font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** How many words show at once, and whether Thai/Lao words sit together. */
export function CaptionLayoutControls({ style, onChange }: Props) {
  const mode = captionModeOf(style);
  const groupKey = mode === "fixed" ? String(Math.min(4, Math.max(2, style.wordsPerGroup))) : mode;
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Segmented
        label="ขึ้นซับครั้งละ"
        choices={GROUPS}
        current={groupKey}
        onPick={(choice) => onChange(choice.patch)}
      />
      <Segmented
        label="ตัวหนังสือ"
        choices={JOIN}
        current={style.joinWords === false ? "space" : "join"}
        onPick={(choice) => onChange(choice.patch)}
      />
    </div>
  );
}
