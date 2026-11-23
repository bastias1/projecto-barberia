import Link from "next/link";
import { LINKS_LEGALES } from "@/lib/plataforma";

/** Enlaces a las páginas legales de la plataforma (footers). */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Información legal" className={`flex flex-wrap justify-center gap-x-4 gap-y-0 ${className}`}>
      {LINKS_LEGALES.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline hover:text-foreground">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
