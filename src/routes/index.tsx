import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Captions,
  Check,
  Download,
  Film,
  Languages,
  Palette,
  Scissors,
  Smile,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getPricing } from "@/lib/account.functions";
import { formatKip, formatMinutes } from "@/lib/account-shared";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OneRunAI — ใส่ซับลาวให้คลิปไวรัลด้วย OneRun" },
      {
        name: "description",
        content:
          "AI ถอดเสียงภาษาลาวเป็นซับทีละคำ ตัดช่วงเงียบ ใส่สไตล์ สติกเกอร์ และ B-roll แล้วส่งออกพร้อมโพสต์ TikTok, Reels, Shorts ทดลองใช้ฟรี 5 วัน",
      },
      { property: "og:title", content: "OneRunAI — ใส่ซับลาวให้คลิปไวรัลด้วย OneRun" },
      {
        property: "og:description",
        content: "ซับลาวแม่นยำ ตัดช่วงเงียบ สไตล์ไวรัล ส่งออกพร้อมโพสต์ ทดลองใช้ฟรี 5 วัน",
      },
    ],
  }),
  component: Landing,
});

/** Code shown on the pricing card; prices match the promo row in the database. */
const PROMO = { code: "ONERUN", monthlyKip: 99_000, yearlyKip: 990_000 };

const NAV = [
  { href: "#features", label: "ฟีเจอร์" },
  { href: "#how", label: "วิธีใช้" },
  { href: "#pricing", label: "ราคา" },
  { href: "#faq", label: "คำถาม" },
];

const FEATURES = [
  {
    icon: Captions,
    title: "ซับภาษาลาวแม่นยำ",
    text: "AI หลายตัวช่วยกันถอดเสียงลาวเป็นอักษรลาวทีละคำ คำอังกฤษที่พูดปนก็ไม่หลุด",
    wide: true,
  },
  {
    icon: Scissors,
    title: "ตัดช่วงเงียบอัตโนมัติ",
    text: "ลบช่วงพูดเว้นว่างให้คลิปกระชับ จังหวะไวแบบคลิปไวรัล",
  },
  {
    icon: Palette,
    title: "สไตล์ซับพร้อมใช้",
    text: "Podcast สองบรรทัด ไฮไลต์คำ แถบสี และเปลี่ยนสีทีละคำได้",
  },
  {
    icon: Smile,
    title: "อิโมจิและ Motion Graphic",
    text: "อิโมจิเคลื่อนไหว ลูกศร ปุ่ม Follow และสติกเกอร์ของคุณเอง",
  },
  {
    icon: Film,
    title: "B-roll ฟรีในคลิกเดียว",
    text: "AI แนะนำคำค้น แล้วเลือกวิดีโอและรูปฟรีใส่ในซีนได้ทันที",
  },
  {
    icon: Languages,
    title: "แปลซับหลายภาษา",
    text: "แปลเป็นไทย ลาว หรืออังกฤษในคลิกเดียว เข้าถึงคนดูได้กว้างขึ้น",
  },
  {
    icon: Download,
    title: "ส่งออกถึง 4K",
    text: "เลือกความละเอียดและ FPS พร้อมซับหรือไม่มีซับ หรือส่งต่อเข้า CapCut",
    wide: true,
  },
];

const STEPS = [
  { icon: Upload, title: "อัปโหลดคลิป", text: "เลือกไฟล์จากมือถือหรือคอม รองรับ MP4 และ MOV" },
  {
    icon: Wand2,
    title: "AI ใส่ซับให้",
    text: "ถอดเสียงลาว ตัดช่วงเงียบ และจัดจังหวะคำให้อัตโนมัติ",
  },
  {
    icon: Sparkles,
    title: "แต่งแล้วส่งออก",
    text: "เลือกสไตล์ ใส่สติกเกอร์และ B-roll แล้วโพสต์ได้เลย",
  },
];

const FAQ = [
  {
    q: "ทดลองใช้ฟรีต้องผูกบัตรไหม?",
    a: "ไม่ต้องครับ สมัครด้วยอีเมลแล้วใช้ได้ทุกฟีเจอร์ 5 วัน หมดแล้วเลือกได้ว่าจะสมัครต่อหรือไม่",
  },
  {
    q: "ชำระเงินยังไง?",
    a: "สแกน QR โอนผ่านแอปธนาคาร แล้วอัปโหลดสลิปในหน้าชำระเงิน ทีมงานตรวจสอบแล้วเปิดสิทธิ์ให้",
  },
  {
    q: "รองรับภาษาอะไรบ้าง?",
    a: "ถอดเสียงภาษาลาวเป็นหลัก รองรับไทยและอังกฤษ และแปลซับเป็นภาษาอื่นได้ในคลิกเดียว",
  },
  {
    q: "ใช้บนมือถือได้ไหม?",
    a: "ได้ครับ เปิดผ่านเบราว์เซอร์บน iPhone หรือ Android ได้เลย ไม่ต้องลงแอป",
  },
  {
    q: "นาทีถอดเสียงคืออะไร?",
    a: "คือความยาวเสียงที่ให้ AI ถอดเป็นซับ ทดลองใช้ได้ 30 นาที แพ็กเกจรายเดือนและรายปีได้ 300 นาทีต่อเดือน",
  },
];

/** Fades content up as it scrolls into view (shown at once when motion is reduced). */
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        shown
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PhoneLook = "podcast" | "karaoke" | "bar";

/** A phone showing a stylised clip with Lao captions appearing word by word. */
function Phone({
  look,
  lines,
  scene,
  className,
}: {
  look: PhoneLook;
  lines: string[][];
  scene: string;
  className?: string;
}) {
  const words = lines.flat();
  const cycle = words.length * 0.55 + 1.4;
  return (
    <div
      className={cn(
        "relative aspect-[9/19] w-[150px] shrink-0 overflow-hidden rounded-[1.6rem] border border-white/15 bg-black shadow-[0_30px_80px_-20px_rgba(124,58,237,0.55)] sm:w-[190px]",
        className,
      )}
    >
      <div className="absolute inset-0" style={{ background: scene }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute left-1/2 top-2 h-4 w-14 -translate-x-1/2 rounded-full bg-black/80" />
      <div
        className={cn(
          "absolute inset-x-3 bottom-[22%] font-['Noto_Sans_Lao'] font-black leading-tight",
          look === "podcast" ? "text-left" : "text-center",
        )}
        style={{ textShadow: look === "bar" ? undefined : "0 2px 8px rgba(0,0,0,0.85)" }}
      >
        {lines.map((line, li) => (
          <div
            key={li}
            className={cn(
              look === "podcast" && li === 1
                ? "text-[1.55rem] text-[#ffd400] sm:text-[1.9rem]"
                : "text-[1rem] text-white sm:text-[1.2rem]",
              look === "bar" && "mb-1 inline-block rounded-sm bg-[#facc15] px-1.5 text-[#111]",
            )}
          >
            {line.map((word) => (
              <span
                key={word}
                className={cn("onerun-word inline-block", look === "karaoke" && "onerun-karaoke")}
                style={{
                  animationDelay: `${words.indexOf(word) * 0.55}s`,
                  animationDuration: `${cycle}s`,
                }}
              >
                {word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  const { session } = useSession();
  const fetchPricing = useServerFn(getPricing);
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing(), retry: false });
  const monthly = pricing.data?.plans.find((plan) => plan.id === "monthly");
  const yearly = pricing.data?.plans.find((plan) => plan.id === "yearly");
  const trial = pricing.data?.trial;
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const trialDays = trial?.durationDays ?? 5;
  const startLabel = session ? "เปิดแอป" : `ทดลองใช้ฟรี ${trialDays} วัน`;
  const startLink = (className: string, children: ReactNode = startLabel) =>
    session ? (
      <Link to="/app" className={className}>
        {children}
      </Link>
    ) : (
      <Link to="/login" search={{ mode: "signup" }} className={className}>
        {children}
      </Link>
    );

  const paid = billing === "monthly" ? monthly : yearly;
  const paidPrice = paid?.priceKip ?? (billing === "monthly" ? 199_000 : 1_990_000);
  const promoPrice = billing === "monthly" ? PROMO.monthlyKip : PROMO.yearlyKip;
  const quota = formatMinutes(paid?.quotaSeconds ?? 18_000);

  return (
    <div className="dark">
      <main className="relative min-h-screen overflow-x-hidden bg-[#07060b] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(60%_50%_at_70%_10%,rgba(139,92,246,0.35),transparent_70%),radial-gradient(40%_40%_at_10%_30%,rgba(236,72,153,0.16),transparent_70%)]"
        />

        {/* floating pill nav */}
        <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/50 py-2 pl-3 pr-2 backdrop-blur-xl">
            <OneRunLogo className="[&>span:first-child]:h-8 [&>span:first-child]:w-8 [&>span+span]:text-lg" />
            <nav
              aria-label="เมนูหลัก"
              className="hidden items-center gap-1 rounded-full bg-white/5 p-1 md:flex"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-1 sm:gap-2">
              {!session && (
                <Link
                  to="/login"
                  className="rounded-full px-3 py-2 text-sm text-white/80 hover:text-white"
                >
                  เข้าสู่ระบบ
                </Link>
              )}
              {startLink(
                "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90",
                session ? "เปิดแอป" : "เริ่มฟรี",
              )}
            </div>
          </div>
        </header>

        {/* hero */}
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> AI Subtitle
              สำหรับคนทำคอนเทนต์ภาษาลาว
            </p>
            <h1 className="mt-6 font-landing text-[2.6rem] font-black leading-[1.08] tracking-tight sm:text-6xl">
              ใส่ซับลาวให้คลิป
              <br />
              <span className="bg-gradient-to-r from-white via-violet-200 to-violet-500 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(167,139,250,0.55)]">
                ไวรัล
              </span>{" "}
              <span className="whitespace-nowrap">ด้วย OneRun</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              อัปโหลดคลิป แล้วให้ AI ถอดเสียงลาวเป็นซับทีละคำ ตัดช่วงเงียบ ใส่สไตล์ สติกเกอร์ และ
              B-roll ให้พร้อมโพสต์ TikTok, Reels และ Shorts
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {startLink(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 font-semibold text-white shadow-[0_10px_40px_-10px_rgba(168,85,247,0.8)] transition hover:brightness-110",
                <>
                  {startLabel} <ArrowRight className="h-4 w-4" />
                </>,
              )}
              <a
                href="#how"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-7 font-semibold text-white/90 transition hover:bg-white/5"
              >
                ดูวิธีใช้
              </a>
            </div>
            <p className="mt-4 text-xs text-white/45">
              ไม่ต้องผูกบัตร · ใช้ผ่านเบราว์เซอร์ได้ทั้งมือถือและคอม
            </p>
          </Reveal>

          <Reveal
            delay={150}
            className="relative flex h-[360px] items-center justify-center sm:h-[460px]"
          >
            <Phone
              look="karaoke"
              scene="linear-gradient(160deg,#1e3a8a,#0f172a 55%,#312e81)"
              lines={[
                ["ມື້ນີ້", "ຂ້ອຍ", "ຈະ"],
                ["ພາ", "ໄປ", "ກິນ"],
              ]}
              className="absolute left-1/2 top-1/2 -translate-x-[115%] -translate-y-[46%] -rotate-[8deg] opacity-90"
            />
            <Phone
              look="bar"
              scene="linear-gradient(200deg,#7c2d12,#1c1917 60%,#451a03)"
              lines={[["ລາຄາ", "ບໍ່", "ແພງ"]]}
              className="absolute left-1/2 top-1/2 translate-x-[15%] -translate-y-[46%] rotate-[8deg] opacity-90"
            />
            <Phone
              look="podcast"
              scene="linear-gradient(180deg,#4c1d95,#1e1b4b 50%,#0b0a12)"
              lines={[["ຂໍແຄ່"], ["ຫາເງິນ"]]}
              className="relative z-10 -translate-y-[4%]"
            />
          </Reveal>
        </section>

        {/* platforms */}
        <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-y border-white/5 py-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/35 sm:text-sm">
            <span>TikTok</span>
            <span>Reels</span>
            <span>YouTube Shorts</span>
            <span>Facebook</span>
            <span>CapCut</span>
          </div>
        </Reveal>

        {/* features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-violet-300">ฟีเจอร์</p>
            <h2 className="mt-3 font-landing text-3xl font-black sm:text-5xl">
              ทุกอย่างที่คลิปสั้นต้องมี
            </h2>
            <p className="mt-4 text-white/60">
              ไม่ต้องสลับหลายแอป ใส่ซับ แต่งคลิป และส่งออกได้ในที่เดียว
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, wide }, i) => (
              <Reveal key={title} delay={i * 60} className={cn(wide && "md:col-span-2")}>
                <div className="h-full rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 transition hover:border-violet-400/40">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-violet-300">วิธีใช้</p>
            <h2 className="mt-3 font-landing text-3xl font-black sm:text-5xl">
              3 ขั้นตอน คลิปพร้อมโพสต์
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                  <span className="absolute -right-2 -top-6 font-landing text-[7rem] font-black leading-none text-white/[0.04]">
                    {i + 1}
                  </span>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">
                    {i + 1}. {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* pricing */}
        <section
          id="pricing"
          className="relative mx-auto max-w-5xl scroll-mt-24 px-4 py-24 sm:px-6"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-12 select-none text-center font-landing text-[5rem] font-black leading-none text-white/[0.06] blur-[2px] sm:text-[9rem]"
          >
            Pricing
          </div>
          <Reveal className="relative text-center">
            <p className="text-sm font-semibold text-violet-300">ราคา</p>
            <h2 className="mt-3 font-landing text-3xl font-black sm:text-5xl">
              เริ่มฟรี จ่ายเมื่อพร้อม
            </h2>
            <div
              role="radiogroup"
              aria-label="รอบการชำระ"
              className="mx-auto mt-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1"
            >
              {(
                [
                  ["monthly", "รายเดือน"],
                  ["yearly", "รายปี"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={billing === value}
                  onClick={() => setBilling(value)}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-semibold transition",
                    billing === value ? "bg-white text-black" : "text-white/70 hover:text-white",
                  )}
                >
                  {label}
                  {value === "yearly" && (
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        billing === value ? "text-emerald-600" : "text-emerald-400",
                      )}
                    >
                      ฟรี 2 เดือน
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Reveal>

          <div className="relative mt-12 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">
                <p className="text-sm text-white/60">ทดลองใช้</p>
                <p className="mt-2 font-landing text-5xl font-black">ฟรี</p>
                <p className="mt-1 text-sm text-white/50">{trialDays} วัน · ไม่ต้องผูกบัตร</p>
                {startLink(
                  "mt-7 flex h-11 items-center justify-center rounded-full border border-white/15 font-semibold transition hover:bg-white/5",
                  session ? "เปิดแอป" : "เริ่มทดลองฟรี",
                )}
                <ul className="mt-7 space-y-3 text-sm text-white/75">
                  {[
                    `AI ถอดเสียงรวม ${formatMinutes(trial?.quotaSeconds ?? 1800)}`,
                    "ใช้ได้ทุกฟีเจอร์",
                    "ส่งออกวิดีโอพร้อมซับ",
                  ].map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" /> {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="relative h-full rounded-3xl bg-white p-8 text-black shadow-[0_30px_80px_-20px_rgba(168,85,247,0.6)]">
                <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1 text-xs font-bold text-white">
                  ยอดนิยม
                </span>
                <p className="text-sm text-black/60">
                  Pro {billing === "monthly" ? "รายเดือน" : "รายปี"}
                </p>
                <p className="mt-2 font-landing text-4xl font-black sm:text-5xl">
                  {formatKip(promoPrice)}
                </p>
                <p className="mt-1 text-sm text-black/55">
                  <span className="line-through">{formatKip(paidPrice)}</span> · ใช้โค้ด{" "}
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-700">
                    {PROMO.code}
                  </span>{" "}
                  {billing === "monthly" ? "ต่อเดือน" : "ต่อปี"}
                </p>
                {startLink(
                  "mt-7 flex h-11 items-center justify-center rounded-full bg-black font-semibold text-white transition hover:bg-black/85",
                  session ? "เปิดแอป" : `ทดลองฟรี ${trialDays} วันก่อน`,
                )}
                <ul className="mt-7 space-y-3 text-sm text-black/75">
                  {[
                    `AI ถอดเสียง ${quota} ต่อเดือน`,
                    "ทุกฟีเจอร์: สไตล์ สติกเกอร์ B-roll",
                    "ส่งออกถึง 4K ไม่มีลายน้ำ",
                    "ชำระผ่าน QR ธนาคาร",
                  ].map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" /> {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24 sm:px-6">
          <Reveal className="text-center">
            <h2 className="font-landing text-3xl font-black sm:text-4xl">คำถามที่พบบ่อย</h2>
          </Reveal>
          <Reveal className="mt-10">
            <Accordion
              type="single"
              collapsible
              className="rounded-3xl border border-white/10 bg-white/[0.03] px-6"
            >
              {FAQ.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`q${i}`}
                  className="border-white/10 last:border-b-0"
                >
                  <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-white/65">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        {/* final call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-700/40 via-[#120d22] to-fuchsia-700/30 px-6 py-16 text-center">
              <div
                aria-hidden="true"
                className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl"
              />
              <h2 className="relative font-landing text-3xl font-black sm:text-5xl">
                พร้อมทำคลิปไวรัลหรือยัง?
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-white/65">
                อัปโหลดคลิปแรกวันนี้ ใช้เวลาไม่ถึง 5 นาที แล้วโพสต์ได้เลย
              </p>
              {startLink(
                "relative mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 font-semibold text-black transition hover:bg-white/90",
                <>
                  {startLabel} <ArrowRight className="h-4 w-4" />
                </>,
              )}
            </div>
          </Reveal>
        </section>

        {/* footer */}
        <footer className="border-t border-white/5">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <OneRunLogo />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
                เครื่องมือ AI ใส่ซับลาวและตัดคลิปสั้น สำหรับครีเอเตอร์ ร้านค้า และแบรนด์ในลาว
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">เมนู</p>
              <ul className="mt-4 space-y-2 text-sm text-white/65">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="hover:text-white">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                บัญชี
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/65">
                <li>
                  <Link to="/login" className="hover:text-white">
                    เข้าสู่ระบบ
                  </Link>
                </li>
                <li>
                  <Link to="/login" search={{ mode: "signup" }} className="hover:text-white">
                    สมัครใช้งาน
                  </Link>
                </li>
                <li>
                  <Link to="/billing" className="hover:text-white">
                    ชำระเงิน
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-white/5 px-4 py-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>© {new Date().getFullYear()} OneRunAI</span>
            <span>อิโมจิเคลื่อนไหว: Google Noto Emoji (CC BY 4.0)</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
