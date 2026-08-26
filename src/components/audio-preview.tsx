import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX, Music } from 'lucide-react';
import { animationOptions, type CaptionAnimation } from '@/lib/captions';
import type { SoundPack } from '@/lib/audio-system';

type Props = { animation: CaptionAnimation; enabled: boolean; volume: number; pack: SoundPack; onChange: (value: { enabled?: boolean; volume?: number; pack?: SoundPack }) => void };

export function AudioPreview({ animation, enabled, volume, pack, onChange }: Props) {
  const { play, setVolume, setEnabled, setPack } = useAudioFeedback();

  const handleVolumeChange = (val: number[]) => {
    const next = (val[0] ?? 50) / 100;
    setVolume(next);
    onChange({ volume: next });
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    onChange({ enabled: checked });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-6 h-6" /> Animation Sound Effects
        </h2>
        <p className="text-sm text-muted-foreground">
          เสียงสังเคราะห์ปลอดลิขสิทธิ์ เล่นตามจังหวะ Animation
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            <Label htmlFor="audio-enabled">เปิดเสียง Animation</Label>
          </div>
          <Switch 
            id="audio-enabled" 
            checked={enabled} 
            onCheckedChange={handleToggle} 
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <Label>ระดับเสียง</Label>
            <span>{Math.round(volume * 100)}%</span>
          </div>
          <Slider 
            value={[volume * 100]} 
            max={100} 
            step={1} 
            onValueChange={handleVolumeChange}
            disabled={!enabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(['clean', 'punch', 'soft', 'digital'] as SoundPack[]).map((value) => (
          <Button key={value} size="sm" variant={pack === value ? "default" : "outline"} onClick={() => { setPack(value); onChange({ pack: value }); void play(animation); }} className="capitalize">{value}</Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {animationOptions.filter(({ value }) => value !== "none").map(({ value, label }) => (
          <Button 
            key={value} 
            variant="outline" 
            onClick={() => play(value)}
            disabled={!enabled}
          >
            ฟัง {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
