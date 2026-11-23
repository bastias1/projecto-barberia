import { PLATAFORMA } from "@/lib/plataforma";
import { LegalLinks } from "@/components/legal-links";
import { Marca } from "./marca";

export function FooterPlataforma({ creditos }: { creditos?: React.ReactNode }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
        <Marca />
        <LegalLinks className="!justify-start md:!justify-center" />
        <div className="flex flex-col gap-1 md:items-end">
          <a href={`mailto:${PLATAFORMA.emailContacto}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{PLATAFORMA.emailContacto}</a>
          <p className="text-muted-foreground">© {new Date().getFullYear()} {PLATAFORMA.nombre}</p>
        </div>
      </div>
      {creditos && <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">{creditos}</p>}
    </footer>
  );
}
