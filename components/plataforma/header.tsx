import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Marca } from "./marca";
import { MenuMovil, type EnlaceNav } from "./menu-movil";

const ENLACES_LANDING: EnlaceNav[] = [
  { href: "/#producto", label: "Producto" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#planes", label: "Planes" },
  { href: "/barberias", label: "Buscar barberías" },
];

/**
 * Cabecera de la plataforma. En teléfono: marca + menú; desde md: enlaces en línea.
 * `miPanel` = destino del panel si hay sesión. Páginas sin enlaces (login, registro) pasan `simple`.
 */
export function HeaderPlataforma({ miPanel = null, simple = false }: { miPanel?: string | null; simple?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Marca />
        {!simple && (
          <nav aria-label="Principal" className="hidden items-center gap-1 text-sm font-medium md:flex">
            {ENLACES_LANDING.map((e) => (
              <Link key={e.href} href={e.href} className="rounded-md px-3 py-3 text-muted-foreground transition-colors hover:text-foreground">{e.label}</Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <ModeToggle />
          {simple ? (
            <Button asChild variant="outline" className="h-11">
              <Link href="/">Volver</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden h-11 md:inline-flex">
                <Link href={miPanel ?? "/login"}>{miPanel ? "Mi panel" : "Iniciar sesión"}</Link>
              </Button>
              <Button asChild className="hidden h-11 md:inline-flex">
                <Link href="/registro">Prueba gratis</Link>
              </Button>
              <MenuMovil enlaces={ENLACES_LANDING} miPanel={miPanel} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
