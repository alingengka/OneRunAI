import { Heart, MessageCircle, Music2, Share2, UserRound } from "lucide-react";

export function TikTokSafeAreaOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-primary-foreground" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-background/80 to-transparent" />
      <div className="absolute bottom-[18%] right-[3.5%] flex flex-col items-center gap-4 drop-shadow-lg">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/70 bg-background/25"><UserRound className="h-5 w-5" /></div>
        <Heart className="h-7 w-7" />
        <MessageCircle className="h-7 w-7" />
        <Share2 className="h-7 w-7" />
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background/75"><Music2 className="h-4 w-4" /></div>
      </div>
      <div className="absolute bottom-[7%] left-[4%] w-[70%] space-y-1 drop-shadow-lg">
        <div className="h-2.5 w-20 rounded-full bg-primary-foreground/90" />
        <div className="h-2 w-44 rounded-full bg-primary-foreground/65" />
        <div className="h-2 w-32 rounded-full bg-primary-foreground/65" />
      </div>
      <div className="absolute inset-x-[7%] bottom-[16%] border-t border-dashed border-primary-foreground/55" />
      <div className="absolute inset-x-[7%] top-[8%] border-t border-dashed border-primary-foreground/55" />
    </div>
  );
}