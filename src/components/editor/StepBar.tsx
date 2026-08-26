import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

export type StepState = "done" | "active" | "todo" | "busy";

export type Step = {
  key: string;
  label: string;
  hint: string;
  state: StepState;
};

export function StepBar({ steps, onSelect }: { steps: Step[]; onSelect: (key: string) => void }) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <li key={step.key} className="min-w-[150px] flex-1">
          <button
            type="button"
            onClick={() => onSelect(step.key)}
            className={cn(
              "w-full rounded-xl border px-3 py-2 text-left transition",
              step.state === "done" && "border-primary/40 bg-primary/10",
              step.state === "active" && "border-primary bg-card shadow-sm",
              step.state === "busy" && "border-primary bg-primary/5",
              step.state === "todo" && "border-border bg-secondary/40",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                  step.state === "done" || step.state === "busy"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {step.state === "done" ? (
                  <Check className="h-3 w-3" />
                ) : step.state === "busy" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              {step.label}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{step.hint}</p>
          </button>
        </li>
      ))}
    </ol>
  );
}
