import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Captions, Check, Film, Languages, Scissors, Sparkles, Wand2 } from "lucide-react";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { Button } from "@/components/ui/button";
import { getPricing } from "@/lib/account.functions";
import { formatKip, formatMinutes } from "@/lib/account-shared";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OneRunAI — ตัดคลิปสั้นและซับลาวด้วย AI" },
      {
        name: "description",
        content:
          "สร้างซับไตเติลภาษาลาวแบบทีละคำอัตโนมัติ ตัดช่วงเงียบ ใส่ B-roll และส่งออกวิดีโอพร้อมโพสต์ ทดลองใช้ฟรี 5 วัน",
      },
      { property: "og:title", content: "OneRunAI — ตัดคลิปสั้นและซับลาวด้วย AI" },
      {
        property: "og:description",
        content: "ซับลาวแม่นยำ ตัด dead-air และส่งออกเข้า CapCut ทดลองใช้ฟรี 5 วัน",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Captions,
    title: "ซับภาษาลาวแม่นยำ",
    text: "ถอดเสียงลาวเป็นอักษรลาวทีละคำ รองรับคำอังกฤษที่พูดปนในประโยค",
  },
  {
    icon: Scissors,
    title: "ตัดช่วงเงียบอัตโนมัติ",
    text: "ลบ dead-air ให้คลิปกระชับ จังหวะไวแบบคลิปไวรัล",
  },
  {
    icon: Wand2,
    title: "สไตล์ซับพร้อมใช้",
    text: "ฟอนต์ลาว 7 แบบ เอฟเฟกต์ไฮไลต์คำ และกรอบปลอดภัยสำหรับ TikTok",
  },
  {
    icon: Film,
    title: "B-roll และข้อความไวรัล",
    text: "ใส่ภาพประกอบ GIF และข้อความเด้งตามจังหวะพูด",
  },
  { icon: Languages, title: "แปลซับหลายภาษา", text: "แปลเป็นไทย ลาว หรืออังกฤษได้ในคลิกเดียว" },
  {
    icon: Sparkles,
    title: "ส่งออกพร้อมโพสต์",
    text: "เรนเดอร์วิดีโอพร้อมซับ หรือส่งต่อไปแก้ใน CapCut",
  },
];

function Landing() {
  const { session } = useSession();
  const fetchPricing = useServerFn(getPricing);
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing(), retry: false });
  const monthly = pricing.data?.plans.find((plan) => plan.id === "monthly");
  const yearly = pricing.data?.plans.find((plan) => plan.id === "yearly");
  const trial = pricing.data?.trial;

  const primaryCta = session ? (
    <Button size="lg" asChild>
      <Link to="/app">เปิดแอป</Link>
    </Button>
  ) : (
    <Button size="lg" asChild>
      <Link to="/login" search={{ mode: "signup" }}>
        ทดลองใช้ฟรี 5 วัน
      </Link>
    </Button>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <OneRunLogo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <a href="#pricing">ราคา</a>
          </Button>
          {session ? (
            <Button asChild>
              <Link to="/app">เปิดแอป</Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <Link to="/login">เข้าสู่ระบบ</Link>
            </Button>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pt-20">
        <p className="mx-auto inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          AI Short Video Editor สำหรับคนทำคอนเทนต์ภาษาลาว
        </p>
        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          ตัดคลิปสั้น ใส่ซับลาว
          <br />
          <span className="text-primary">เสร็จในไม่กี่นาที</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          อัปโหลดคลิป แล้วให้ AI ถอดเสียงภาษาลาวเป็นซับทีละคำ ตัดช่วงเงียบ และจัดสไตล์ให้พร้อมโพสต์
          TikTok, Reels และ Shorts
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {primaryCta}
          <Button size="lg" variant="ghost" asChild>
            <a href="#features">ดูฟีเจอร์</a>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">ไม่ต้องผูกบัตร · ยกเลิกได้ทุกเมื่อ</p>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">ทุกอย่างที่ต้องใช้ทำคลิปสั้น</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">ราคา</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          ใส่โค้ด <span className="font-semibold text-primary">ONERUN</span>{" "}
          ตอนชำระเงินเพื่อรับส่วนลด
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="ทดลองใช้ฟรี"
            price="ฟรี"
            period={`${trial?.durationDays ?? 5} วัน`}
            points={[
              `AI ถอดเสียงรวม ${formatMinutes(trial?.quotaSeconds ?? 1800)}`,
              "ใช้ได้ทุกฟีเจอร์",
              "ไม่ต้องผูกบัตร",
            ]}
          />
          <PriceCard
            name="รายเดือน"
            price={formatKip(monthly?.priceKip ?? 199000)}
            period="ต่อเดือน"
            points={[
              `AI ถอดเสียง ${formatMinutes(monthly?.quotaSeconds ?? 18000)}/เดือน`,
              "ใช้ได้ทุกฟีเจอร์",
              "ชำระผ่าน QR",
            ]}
          />
          <PriceCard
            highlight
            name="รายปี"
            price={formatKip(yearly?.priceKip ?? 1990000)}
            period="ต่อปี · ฟรี 2 เดือน"
            points={[
              `AI ถอดเสียง ${formatMinutes(yearly?.quotaSeconds ?? 18000)}/เดือน`,
              "ใช้ได้ทุกฟีเจอร์",
              "คุ้มที่สุด",
            ]}
          />
        </div>
        <div className="mt-10 text-center">{primaryCta}</div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OneRunAI
      </footer>
    </main>
  );
}

function PriceCard({
  name,
  price,
  period,
  points,
  highlight = false,
}: {
  name: string;
  price: string;
  period: string;
  points: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border-2 border-primary bg-card p-6 shadow-lg"
          : "rounded-2xl border border-border bg-card p-6"
      }
    >
      <div className="font-semibold">{name}</div>
      <div className="mt-3 text-3xl font-black">{price}</div>
      <div className="text-xs text-muted-foreground">{period}</div>
      <ul className="mt-6 space-y-2 text-sm">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
