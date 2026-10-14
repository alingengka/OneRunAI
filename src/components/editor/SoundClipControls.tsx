import { Copy, Play, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type SoundEditing = {
  id: string;
  name: string;
  /** 0..2 */
  volume: number;
  onVolume: (volume: number) => void;
  onPreview: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/** Settings for one placed sound effect: listen, loudness, split, duplicate, delete. */
export function SoundClipControls({ sound }: { sound: SoundEditing }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">เสียงที่เลือก</p>
        <p className="mt-1 truncate text-lg font-bold">♪ {sound.name}</p>
      </div>
      <Button variant="secondary" className="w-full" onClick={sound.onPreview}>
        <Play className="mr-2 h-4 w-4" /> ฟังเสียงนี้
      </Button>
      <div className="space-y-2">
        <span className="flex justify-between text-xs text-muted-foreground">
          <span>ระดับเสียง</span>
          <span className="font-mono text-foreground">{Math.round(sound.volume * 100)}%</span>
        </span>
        <Slider
          value={[sound.volume * 100]}
          min={0}
          max={200}
          step={5}
          aria-label="ระดับเสียง"
          onValueChange={([value]) => sound.onVolume((value ?? 100) / 100)}
        />
      </div>
      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" className="flex-1" onClick={sound.onSplit}>
          <Scissors className="mr-1.5 h-4 w-4" /> ตัด
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={sound.onDuplicate}>
          <Copy className="mr-1.5 h-4 w-4" /> ทำซ้ำ
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={sound.onDelete}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> ลบ
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        ลากแถบสีฟ้าบนไทม์ไลน์เพื่อเลื่อนจังหวะ ลากขอบเพื่อตัดหัวหรือท้ายเสียง
      </p>
    </div>
  );
}
