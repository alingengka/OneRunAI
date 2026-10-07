import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  Download,
  Film,
  Languages,
  Palette,
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
import { formatKip } from "@/lib/account-shared";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { initialLang, LANDING_COPY, LANGS, saveLang, type Lang } from "@/lib/landing-i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OneRunAI — ใส่ซับลาวให้คลิปไวรัลด้วย OneRun" },
      {
        name: "description",
        content:
          "AI ถอดเสียงภาษาลาวเป็นซับทีละคำ ใส่สไตล์ สติกเกอร์ และ B-roll แล้วส่งออกพร้อมโพสต์ TikTok, Reels, Shorts ทดลองใช้ฟรี 5 วัน",
      },
      { property: "og:title", content: "OneRunAI — ใส่ซับลาวให้คลิปไวรัลด้วย OneRun" },
      {
        property: "og:description",
        content: "ซับลาวแม่นยำ สไตล์ไวรัล ส่งออกพร้อมโพสต์ ทดลองใช้ฟรี 5 วัน",
      },
    ],
  }),
  component: Landing,
});

/** Code shown on the pricing card; prices match the promo row in the database. */
const PROMO = { code: "ONERUN", monthlyKip: 99_000, yearlyKip: 990_000 };

const NAV_HREFS = ["#features", "#how", "#pricing", "#faq"] as const;
const FEATURE_ICONS = [Captions, AudioLines, Palette, Smile, Film, Languages, Download];
/** Bento cards that span two columns. */
const WIDE_FEATURES = new Set([0, 6]);
const STEP_ICONS = [Upload, Wand2, Sparkles];

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

/**
 * A phone playing a real clip edited with OneRun: silent and looped, and
 * only while on screen (saves data on phones).
 */
function ShowcasePhone({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className={cn(
        "relative aspect-[9/16] w-[150px] shrink-0 overflow-hidden rounded-[1.6rem] border border-white/15 bg-black shadow-[0_30px_80px_-20px_rgba(124,58,237,0.55)] sm:w-[200px]",
        className,
      )}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        aria-label={label}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

const SHOWCASE = [
  { id: "lao-2", label: "ตัวอย่างคลิปซับลาว" },
  { id: "thai-1", label: "ตัวอย่างคลิปซับไทย" },
  { id: "lao-1", label: "ตัวอย่างคลิปซับลาว" },
] as const;

function Landing() {
  const { session } = useSession();
  const fetchPricing = useServerFn(getPricing);
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing(), retry: false });
  const monthly = pricing.data?.plans.find((plan) => plan.id === "monthly");
  const yearly = pricing.data?.plans.find((plan) => plan.id === "yearly");
  const trial = pricing.data?.trial;
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [lang, setLang] = useState<Lang>("th");
  useEffect(() => setLang(initialLang()), []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const pickLang = (next: Lang) => {
    setLang(next);
    saveLang(next);
  };
  const t = LANDING_COPY[lang];
  const nav = [t.nav.features, t.nav.how, t.nav.pricing, t.nav.faq].map((label, i) => ({
    href: NAV_HREFS[i] ?? "#",
    label,
  }));

  const trialDays = trial?.durationDays ?? 5;
  const startLabel = session ? t.openApp : t.tryFree(trialDays);
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
  const minutesOf = (seconds: number) => t.minutes(Math.max(0, Math.floor(seconds / 60)));
  const quota = minutesOf(paid?.quotaSeconds ?? 18_000);

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
              aria-label={t.navLabel}
              className="hidden items-center gap-1 rounded-full bg-white/5 p-1 md:flex"
            >
              {nav.map((item) => (
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
              <div
                role="radiogroup"
                aria-label={t.langLabel}
                className="flex rounded-full bg-white/5 p-0.5 ring-1 ring-white/10"
              >
                {LANGS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    lang={item.id}
                    aria-checked={lang === item.id}
                    onClick={() => pickLang(item.id)}
                    className={cn(
                      "h-7 rounded-full px-2 text-xs font-semibold transition sm:px-2.5",
                      lang === item.id ? "bg-white text-black" : "text-white/60 hover:text-white",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {!session && (
                <Link
                  to="/login"
                  className="hidden rounded-full px-3 py-2 text-sm text-white/80 hover:text-white sm:inline-flex"
                >
                  {t.login}
                </Link>
              )}
              {startLink(
                "whitespace-nowrap rounded-full bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90 sm:px-4",
                session ? t.openApp : t.startFree,
              )}
            </div>
          </div>
        </header>

        {/* hero */}
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> {t.hero.badge}
            </p>
            <h1 className="mt-6 font-landing text-[2.5rem] font-bold leading-[1.2] sm:text-6xl sm:leading-[1.18]">
              {t.hero.line1.map((chunk, i) => (
                <Fragment key={chunk}>
                  {i > 0 && <wbr />}
                  <span className="whitespace-nowrap">{chunk}</span>
                </Fragment>
              ))}
              <br />
              <span className="onerun-viral bg-clip-text text-transparent">
                {t.hero.accent}
              </span>{" "}
              {t.hero.tail}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              {t.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {startLink(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#a977d0] via-[#774a9f] to-[#542a7e] px-7 font-semibold text-white ring-1 ring-white/15 shadow-[0_10px_40px_-12px_rgba(167,118,207,0.85)] transition hover:brightness-110",
                <>
                  {startLabel} <ArrowRight className="h-4 w-4" />
                </>,
              )}
              <a
                href="#how"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-7 font-semibold text-white/90 transition hover:bg-white/5"
              >
                {t.hero.howButton}
              </a>
            </div>
            <p className="mt-4 text-xs text-white/45">{t.hero.note}</p>
          </Reveal>

          <Reveal
            delay={150}
            className="relative flex h-[360px] items-center justify-center sm:h-[460px]"
          >
            {SHOWCASE.map(({ id, label }, i) => (
              <ShowcasePhone
                key={id}
                src={`/showcase/${id}.mp4`}
                poster={`/showcase/${id}.jpg`}
                label={label}
                className={
                  i === 0
                    ? "absolute left-1/2 top-1/2 -translate-x-[115%] -translate-y-[46%] -rotate-[8deg] opacity-90"
                    : i === 1
                      ? "absolute left-1/2 top-1/2 translate-x-[15%] -translate-y-[46%] rotate-[8deg] opacity-90"
                      : "relative z-10 -translate-y-[4%]"
                }
              />
            ))}
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
            <p className="text-sm font-semibold text-violet-300">{t.features.eyebrow}</p>
            <h2 className="mt-3 font-landing text-3xl font-bold leading-[1.25] sm:text-5xl">
              {t.features.title}
            </h2>
            <p className="mt-4 text-white/60">{t.features.subtitle}</p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {t.features.items.map(({ title, text }, i) => {
              const Icon = FEATURE_ICONS[i] ?? Sparkles;
              return (
                <Reveal
                  key={i}
                  delay={i * 60}
                  className={cn(WIDE_FEATURES.has(i) && "md:col-span-2")}
                >
                  <div className="h-full rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 transition hover:border-violet-400/40">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-violet-300">{t.how.eyebrow}</p>
            <h2 className="mt-3 font-landing text-3xl font-bold leading-[1.25] sm:text-5xl">
              {t.how.title}
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {t.how.steps.map(({ title, text }, i) => {
              const Icon = STEP_ICONS[i] ?? Sparkles;
              return (
                <Reveal key={i} delay={i * 100}>
                  <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                    <span className="absolute -right-2 -top-6 font-landing text-[7rem] font-black leading-none text-white/[0.04]">
                      {i + 1}
                    </span>
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-[#a977d0] to-[#542a7e] text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-bold">
                      {i + 1}. {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
                  </div>
                </Reveal>
              );
            })}
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
            <p className="text-sm font-semibold text-violet-300">{t.pricing.eyebrow}</p>
            <h2 className="mt-3 font-landing text-3xl font-bold leading-[1.25] sm:text-5xl">
              {t.pricing.title}
            </h2>
            <div
              role="radiogroup"
              aria-label={t.pricing.cycleLabel}
              className="mx-auto mt-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1"
            >
              {(
                [
                  ["monthly", t.pricing.monthly],
                  ["yearly", t.pricing.yearly],
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
                      {t.pricing.twoMonthsFree}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Reveal>

          <div className="relative mt-12 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">
                <p className="text-sm text-white/60">{t.pricing.trialLabel}</p>
                <p className="mt-2 font-landing text-5xl font-extrabold">{t.pricing.free}</p>
                <p className="mt-1 text-sm text-white/50">{t.pricing.trialNote(trialDays)}</p>
                {startLink(
                  "mt-7 flex h-11 items-center justify-center rounded-full border border-white/15 font-semibold transition hover:bg-white/5",
                  session ? t.openApp : t.pricing.trialButton,
                )}
                <ul className="mt-7 space-y-3 text-sm text-white/75">
                  {t.pricing.trialPoints(minutesOf(trial?.quotaSeconds ?? 1800)).map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" /> {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="relative h-full rounded-3xl bg-white p-8 text-black shadow-[0_30px_80px_-20px_rgba(168,85,247,0.6)]">
                <span className="absolute right-6 top-6 rounded-full bg-gradient-to-b from-[#a977d0] to-[#542a7e] px-3 py-1 text-xs font-bold text-white">
                  {t.pricing.popular}
                </span>
                <p className="text-sm text-black/60">
                  Pro {billing === "monthly" ? t.pricing.monthly : t.pricing.yearly}
                </p>
                <p className="mt-2 font-landing text-4xl font-extrabold sm:text-5xl">
                  {formatKip(promoPrice)}
                </p>
                <p className="mt-1 text-sm text-black/55">
                  <span className="line-through">{formatKip(paidPrice)}</span> · {t.pricing.useCode}{" "}
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-700">
                    {PROMO.code}
                  </span>{" "}
                  {billing === "monthly" ? t.pricing.perMonth : t.pricing.perYear}
                </p>
                {startLink(
                  "mt-7 flex h-11 items-center justify-center rounded-full bg-black font-semibold text-white transition hover:bg-black/85",
                  session ? t.openApp : t.pricing.proButton(trialDays),
                )}
                <ul className="mt-7 space-y-3 text-sm text-black/75">
                  {t.pricing.proPoints(quota).map((point) => (
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
            <h2 className="font-landing text-3xl font-bold leading-[1.25] sm:text-4xl">
              {t.faqTitle}
            </h2>
          </Reveal>
          <Reveal className="mt-10">
            <Accordion
              type="single"
              collapsible
              className="rounded-3xl border border-white/10 bg-white/[0.03] px-6"
            >
              {t.faq.map((item, i) => (
                <AccordionItem key={i} value={`q${i}`} className="border-white/10 last:border-b-0">
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
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-700/40 via-[#120d22] to-[#421b6a]/60 px-6 py-16 text-center">
              <div
                aria-hidden="true"
                className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[#a776cf]/25 blur-3xl"
              />
              <h2 className="relative font-landing text-3xl font-bold leading-[1.25] sm:text-5xl">
                {t.cta.title}
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-white/65">{t.cta.text}</p>
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
                {t.footer.tagline}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                {t.footer.menu}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/65">
                {nav.map((item) => (
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
                {t.footer.account}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/65">
                <li>
                  <Link to="/login" className="hover:text-white">
                    {t.login}
                  </Link>
                </li>
                <li>
                  <Link to="/login" search={{ mode: "signup" }} className="hover:text-white">
                    {t.signup}
                  </Link>
                </li>
                <li>
                  <Link to="/billing" className="hover:text-white">
                    {t.billingLink}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-white/5 px-4 py-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>© {new Date().getFullYear()} OneRunAI</span>
            <span>{t.footer.emojiCredit}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
