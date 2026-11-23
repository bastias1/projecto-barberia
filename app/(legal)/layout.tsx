import { HeaderPlataforma } from "@/components/plataforma/header";
import { FooterPlataforma } from "@/components/plataforma/footer";

// BORRADOR: los textos legales de este grupo (/terminos, /privacidad, /reembolsos,
// /eliminar-datos) no han sido revisados por un abogado. Requieren revisión legal
// y completar los [COMPLETAR] antes de usarlos en producción.

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <HeaderPlataforma simple />

      <main
        id="contenido"
        className="max-w-3xl mx-auto px-4 py-10 space-y-4 leading-relaxed text-base
          [&_h1]:display [&_h1]:text-4xl [&_h1]:[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:pt-6
          [&_h3]:font-semibold [&_h3]:pt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
          [&_a]:underline [&_a]:underline-offset-4 [&_table]:w-full [&_table]:text-sm
          [&_th]:text-left [&_th]:border-b [&_th]:py-2 [&_th]:pr-3 [&_td]:border-b [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top"
      >
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Borrador: este texto está en revisión y puede cambiar.
        </p>
        {children}
      </main>

      <FooterPlataforma />
    </div>
  );
}
