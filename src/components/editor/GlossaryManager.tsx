import { useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { makeRule, removeRule, toggleRule, upsertRule, type LexRule } from "@/lib/lao-glossary";

type Props = {
  glossary: string;
  rules: LexRule[];
  onGlossaryChange: (value: string) => void;
  onRulesChange: (rules: LexRule[]) => void;
  onApplyNow: () => void;
};

export function GlossaryManager({ glossary, rules, onGlossaryChange, onRulesChange, onApplyNow }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const add = () => {
    if (!from.trim() || !to.trim()) return;
    onRulesChange(upsertRule(rules, makeRule(from, to)));
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase text-muted-foreground">คำศัพท์เฉพาะ / ชื่อเฉพาะ (ส่งให้โมเดลตอนถอดเสียง)</Label>
        <Textarea
          value={glossary}
          onChange={(event) => onGlossaryChange(event.target.value)}
          rows={4}
          placeholder="ใส่ชื่อคน สถานที่ แบรนด์ คำเฉพาะ คั่นด้วย comma หรือขึ้นบรรทัดใหม่"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] uppercase text-muted-foreground">กฎแทนคำอัตโนมัติ</Label>
          <Button size="sm" variant="secondary" disabled={!rules.length} onClick={onApplyNow}>
            ใช้กฎกับซับตอนนี้
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="คำที่ถอดผิด" />
          <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="คำที่ถูกต้อง" />
          <Button onClick={add} disabled={!from.trim() || !to.trim()}>
            <Plus className="h-4 w-4" /> เพิ่มกฎ
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ทุกครั้งที่ถอดเสียงหรือถอดใหม่เฉพาะช่วง ระบบจะแก้คำตามกฎเหล่านี้ให้อัตโนมัติ
        </p>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
              rule.enabled ? "border-border" : "border-dashed border-border opacity-60",
            )}
          >
            <div className="min-w-0">
              <p className="truncate">
                <span className="text-muted-foreground line-through">{rule.from}</span>
                <span className="mx-2">→</span>
                <span className="font-medium">{rule.to}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">ใช้แล้ว {rule.hits} ครั้ง</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onRulesChange(toggleRule(rules, rule.id))}>
                {rule.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRulesChange(removeRule(rules, rule.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {!rules.length && <p className="text-xs text-muted-foreground">ยังไม่มีกฎแทนคำ</p>}
      </div>
    </div>
  );
}
