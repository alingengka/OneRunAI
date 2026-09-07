import darkLogo from "@/assets/logo/onerunai-dark.svg";
import lightLogo from "@/assets/logo/onerunai-light.svg";
import { cn } from "@/lib/utils";

export function OneRunLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="OneRunAI">
      <span className="relative block h-10 w-10 shrink-0">
        <img src={darkLogo} alt="" className="absolute inset-0 h-full w-full dark:block hidden" />
        <img src={lightLogo} alt="" className="absolute inset-0 h-full w-full dark:hidden" />
      </span>
      <span className="font-['Bricolage_Grotesque'] text-xl font-bold text-foreground">
        OneRun<span className="text-primary">AI</span>
      </span>
    </div>
  );
}