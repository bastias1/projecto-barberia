import Link from "next/link";
import { Scissors } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { LegalLinks } from "@/components/legal-links";
import { PLATAFORMA } from "@/lib/plataforma";

// BORRADOR: los textos legales de este grupo (/terminos, /privacidad, /reembolsos,
// /eliminar-datos) no han sido revisados por un abogado. Requieren revisión legal
// y completar los [COMPLETAR] antes de usarlos en producción.

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight">
            <span className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Scissors className="h-4 w-4 text-white dark:text-zinc-900" aria-hidden="true" />
            </span>
            {PLATAFORMA.nombre}
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main
        id="contenido"
        className="max-w-3xl mx-auto px-4 py-10 space-y-4 leading-relaxed text-[15px]
          [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:pt-6
          [&_h3]:font-semibold [&_h3]:pt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
          [&_a]:underline [&_a]:underline-offset-4 [&_table]:w-full [&_table]:text-sm
          [&_th]:text-left [&_th]:border-b [&_th]:py-2 [&_th]:pr-3 [&_td]:border-b [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top"
      >
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Borrador: este texto está en revisión y puede cambiar.
        </p>
        {children}
      </main>

      <footer className="border-t py-8 text-sm text-muted-foreground">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center gap-3">
          <LegalLinks />
          <p>© {new Date().getFullYear()} {PLATAFORMA.nombre}</p>
        </div>
      </footer>
    </div>
  );
}
