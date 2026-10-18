import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { getPricing } from "@/lib/account.functions";
import { initialLang, LANGS, saveLang, type Lang } from "@/lib/landing-i18n";
import {
  LEGAL_UI,
  LEGAL_UPDATED,
  PRIVACY,
  TERMS,
  type LegalItem,
  type LegalUi,
} from "@/lib/legal-content";
import { cn } from "@/lib/utils";

/** The terms or privacy page in Lao, Thai or English (same choice as the landing page). */
export function LegalPage({ doc }: { doc: "terms" | "privacy" }) {
  const [lang, setLang] = useState<Lang>("th");
  useEffect(() => setLang(initialLang()), []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const pick = (next: Lang) => {
    setLang(next);
    saveLang(next);
  };
  const content = (doc === "terms" ? TERMS : PRIVACY)[lang];
  const ui = LEGAL_UI[lang];

  return (
    <main className="min-h-dvh bg-background text-foreground" lang={lang}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" aria-label="OneRunAI">
            <OneRunLogo className="[&>span+span]:hidden sm:[&>span+span]:inline" />
          </Link>
          <div className="flex items-center gap-3">
            <div
              role="radiogroup"
              aria-label="Language"
              className="flex rounded-full border border-border p-0.5"
            >
              {LANGS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  lang={item.id}
                  aria-checked={lang === item.id}
                  onClick={() => pick(item.id)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-xs font-semibold",
                    lang === item.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Link
              to="/"
              className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> {ui.home}
            </Link>
          </div>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{content.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ui.updated}: {LEGAL_UPDATED[lang]}
        </p>
        <p className="mt-6 leading-7 text-foreground/90">{content.intro}</p>
        <ol className="mt-8 space-y-8">
          {content.sections.map((section, i) => (
            <li key={section.title}>
              <h2 className="text-lg font-semibold">
                {i + 1}. {section.title}
              </h2>
              <div className="mt-2 space-y-3 leading-7 text-foreground/85">
                {section.paragraphs?.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {section.items && (
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={itemKey(item)} className="ml-5 list-disc">
                        {typeof item === "string" ? (
                          item
                        ) : (
                          <>
                            <strong>{item[0]}</strong> {item[1]}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {section.after?.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {section.contact && <ContactLine ui={ui} />}
              </div>
            </li>
          ))}
        </ol>
        <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">
            {ui.terms}
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            {ui.privacy}
          </Link>
          <Link to="/billing" className="hover:text-foreground">
            {ui.plans}
          </Link>
        </nav>
      </article>
    </main>
  );
}

const itemKey = (item: LegalItem) => (typeof item === "string" ? item : item[0]);

/** The contact the admin set (shown on the pricing page too). */
function ContactLine({ ui }: { ui: LegalUi }) {
  const fetchPricing = useServerFn(getPricing);
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing(), retry: false });
  const contact = pricing.data?.settings.contact;
  return (
    <p>
      {ui.contactAt} {contact ? <strong>{contact}</strong> : ui.contactFallback}
    </p>
  );
}
