import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { getPricing } from "@/lib/account.functions";

export type LegalSection = { title: string; body: ReactNode };

/** Layout for the terms and privacy pages: logo, title, numbered sections. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="หน้าแรก OneRunAI">
            <OneRunLogo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> หน้าแรก
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">ปรับปรุงล่าสุด: {updated}</p>
        <div className="mt-6 space-y-3 leading-7 text-foreground/90">{intro}</div>
        <ol className="mt-8 space-y-8">
          {sections.map((section, i) => (
            <li key={section.title}>
              <h2 className="text-lg font-semibold">
                {i + 1}. {section.title}
              </h2>
              <div className="mt-2 space-y-3 leading-7 text-foreground/85 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                {section.body}
              </div>
            </li>
          ))}
        </ol>
        <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">
            เงื่อนไขการใช้งาน
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link to="/billing" className="hover:text-foreground">
            แพ็กเกจและราคา
          </Link>
        </nav>
      </article>
    </main>
  );
}

/** The contact the admin set (shown on the pricing page too). */
export function ContactLine() {
  const fetchPricing = useServerFn(getPricing);
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing(), retry: false });
  const contact = pricing.data?.settings.contact;
  return (
    <p>
      ติดต่อเราได้ที่ {contact ? <strong>{contact}</strong> : "ช่องทางติดต่อที่แสดงในหน้าแพ็กเกจ"}
    </p>
  );
}
