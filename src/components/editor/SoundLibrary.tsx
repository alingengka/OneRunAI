import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Play, Plus, Search, Square } from "lucide-react";
import {
  SOUND_CATEGORIES,
  SOUND_LIBRARY,
  previewSound,
  stopPreview,
  type SoundCategory,
} from "@/lib/sounds";
import { cn } from "@/lib/utils";

type Props = {
  /** adds the sound at the playhead */
  onAdd: (soundId: string) => void;
  /** how many times each sound is on the timeline */
  usage?: Record<string, number>;
  className?: string;
};

/** The sound library: browse by category, listen, and drop a sound on the timeline. */
export function SoundLibrary({ onAdd, usage = {}, className }: Props) {
  const [category, setCategory] = useState<SoundCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SOUND_LIBRARY.filter(
      (s) =>
        (category === "all" || s.category === category) && (!q || s.name.toLowerCase().includes(q)),
    );
  }, [category, query]);

  const timerRef = useRef(0);
  // leaving the panel stops a preview (the music runs for minutes)
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      stopPreview();
    },
    [],
  );
  /** ▶ plays the sound; tapping it again while it plays stops it. */
  const listen = (id: string, duration: number) => {
    window.clearTimeout(timerRef.current);
    if (playingId === id) {
      stopPreview();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    void previewSound(id);
    timerRef.current = window.setTimeout(
      () => setPlayingId((current) => (current === id ? null : current)),
      duration * 1000,
    );
  };
  const counts = useMemo(() => {
    const n: Record<string, number> = { all: SOUND_LIBRARY.length };
    for (const s of SOUND_LIBRARY) n[s.category] = (n[s.category] ?? 0) + 1;
    return n;
  }, []);
  // "All" lists the sounds under a heading per category
  const sections = useMemo(
    () =>
      SOUND_CATEGORIES.map((c) => ({
        ...c,
        sounds: list.filter((s) => s.category === c.id),
      })).filter((c) => c.sounds.length),
    [list],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-semibold">คลังเสียง</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          กด ▶ เพื่อฟัง กด ＋ เพื่อวางเสียงตรงเส้นเวลาปัจจุบัน แล้วลากแถบบนไทม์ไลน์เพื่อเลื่อนจังหวะ
        </p>
      </div>

      <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-primary">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาเสียง"
          aria-label="ค้นหาเสียง"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="หมวดเสียง">
        {[{ id: "all" as const, label: "ทั้งหมด" }, ...SOUND_CATEGORIES].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            onClick={() => setCategory(item.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              category === item.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span className="ml-1 opacity-60">{counts[item.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {(category === "all" ? sections : [{ id: category, label: "", sounds: list }]).map(
          (section) => (
            <Fragment key={section.id}>
              {section.label && (
                <li className="sticky -top-3 z-10 bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-[0_1px_0_var(--border)] sm:-top-5">
                  {section.label}
                </li>
              )}
              {section.sounds.map((sound) => (
                <li key={sound.id} className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    aria-label={`${playingId === sound.id ? "หยุดเสียง" : "ฟังเสียง"} ${sound.name}`}
                    onClick={() => listen(sound.id, sound.duration)}
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                      playingId === sound.id
                        ? "bg-teal-500 text-white"
                        : "bg-teal-500/15 text-teal-500 hover:bg-teal-500/25",
                    )}
                  >
                    {playingId === sound.id ? (
                      <Square className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{sound.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {sound.duration.toFixed(1)} วิ
                      {usage[sound.id] ? ` · ใช้แล้ว ${usage[sound.id]}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`เพิ่มเสียง ${sound.name}`}
                    onClick={() => onAdd(sound.id)}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-4 w-4" /> เพิ่ม
                  </button>
                </li>
              ))}
            </Fragment>
          ),
        )}
        {!list.length && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">ไม่พบเสียง</li>
        )}
      </ul>
    </div>
  );
}
