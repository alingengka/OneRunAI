import React, { useState } from 'react';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX, Music } from 'lucide-react';

export function AudioPreview() {
  const { play, setVolume, setEnabled } = useAudioFeedback();
  const [volume, setVol] = useState([50]);
  const [enabled, setEn] = useState(true);

  const handleVolumeChange = (val: number[]) => {
    setVol(val);
    setVolume((val[0] ?? 50) / 100);
  };

  const handleToggle = (checked: boolean) => {
    setEn(checked);
    setEnabled(checked);
  };

  return (
    <div className="p-6 space-y-8 border rounded-xl bg-card text-card-foreground shadow-sm max-w-md mx-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-6 h-6" /> Audio Feedback System
        </h2>
        <p className="text-sm text-muted-foreground">
          Synthesized UI sounds for accessible and immersive interaction.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            <Label htmlFor="audio-enabled">Enable Audio</Label>
          </div>
          <Switch 
            id="audio-enabled" 
            checked={enabled} 
            onCheckedChange={handleToggle} 
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <Label>Master Volume</Label>
            <span>{volume[0] ?? 50}%</span>
          </div>
          <Slider 
            value={volume} 
            max={100} 
            step={1} 
            onValueChange={handleVolumeChange}
            disabled={!enabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(['click', 'hover', 'success', 'error', 'open', 'close', 'pop'] as const).map((type) => (
          <Button 
            key={type} 
            variant="outline" 
            onClick={() => play(type)}
            disabled={!enabled}
            className="capitalize"
          >
            Play {type}
          </Button>
        ))}
      </div>
    </div>
  );
}
