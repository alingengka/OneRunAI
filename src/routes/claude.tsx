/** How customers connect OneRun to Claude (the MCP connector). */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/claude")({
  head: () => ({
    meta: [
      { title: "ใช้ OneRun กับ Claude — OneRunAI" },
      {
        name: "description",
        content: "เชื่อม OneRunAI กับ Claude แล้วสั่งทำซับลาวจากคลิปได้ในแชท",
      },
      // not announced yet
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClaudePage,
});

function ClaudePage() {
  const [url, setUrl] = useState("https://www.onerunai.com/api/mcp");
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/api/mcp`), []);
  const copy = async () => {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-xl space-y-8">
        <Link to="/" className="flex justify-center">
          <OneRunLogo />
        </Link>
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">ใช้ OneRun กับ Claude</h1>
          <p className="text-muted-foreground">
            เชื่อมครั้งเดียว แล้วสั่ง Claude ว่า “ทำซับลาวจากคลิปนี้” ได้เลย
          </p>
        </header>

        <section className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
          <h2 className="text-base font-bold">ต้องมีอะไรบ้าง</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>บัญชี OneRun ที่ยังใช้งานได้ (ทดลองใช้หรือแพ็กเกจ)</li>
            <li>
              แอป Claude บนคอม (Claude Desktop / Cowork) หรือ Claude Code — เพราะ Claude
              ต้องดึงเสียงจากคลิปในเครื่องก่อนส่ง
            </li>
            <li>บัญชี Claude ของคุณเอง (แผนฟรีเพิ่มตัวเชื่อมได้ 1 ตัว)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">ขั้นตอนเชื่อมต่อ</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              ในแอป Claude ไปที่ <b>Settings → Connectors</b> (หรือ Customize → Connectors) แล้วกด{" "}
              <b>Add custom connector</b>
            </li>
            <li>
              ตั้งชื่อ <b>OneRunAI</b> และวางลิงก์นี้ในช่อง URL
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2">{url}</code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void copy()}
                  aria-label="คัดลอก"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </li>
            <li>
              กด <b>Add</b> แล้วกด <b>Connect</b> — จะมีหน้าเข้าสู่ระบบ OneRun เด้งขึ้นมา
            </li>
            <li>
              เข้าสู่ระบบด้วยบัญชี OneRun แล้วกด <b>อนุญาต</b>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Claude Code: <code>claude mcp add --transport http onerunai {url}</code>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">วิธีใช้</h2>
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <p>ใส่คลิปให้ Claude แล้วพิมพ์ เช่น</p>
            <p className="rounded-lg bg-muted px-3 py-2">
              ทำซับลาวจากคลิปนี้ด้วย OneRun แล้วบันทึกเป็นไฟล์ .srt
            </p>
            <p className="text-muted-foreground">
              Claude จะดึงเสียงจากคลิป ส่งให้ OneRun ถอดเสียง แล้วได้ไฟล์ซับกลับมา ใช้ต่อใน CapCut
              หรือโปรแกรมตัดต่ออื่นได้เลย
            </p>
          </div>
        </section>

        <section className="space-y-2 text-sm text-muted-foreground">
          <p>• ใช้โควตาในแพ็กเกจ OneRun ของคุณ เหมือนใช้บนเว็บ (นับตามความยาวเสียงพูด)</p>
          <p>• ค่าใช้งาน Claude เป็นของบัญชี Claude ของคุณเอง แยกจาก OneRun</p>
          <p>
            • ยกเลิกการเชื่อมต่อได้ทุกเมื่อที่หน้า{" "}
            <Link to="/billing" className="text-primary underline">
              แพ็กเกจ
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
