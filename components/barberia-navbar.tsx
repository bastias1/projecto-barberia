"use client"

import Link from "next/link";
import { Sun } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { useApariencia } from "@/components/apariencia-provider";
import { BarberiaUserMenu } from "@/components/barberia-user-menu";
import { useBarberia } from "@/components/barberia-provider";
import { PLATAFORMA } from "@/lib/plataforma";

/** Logo de la barbería (claro/oscuro) o su nombre si no tiene logo. */
function BarberiaLogo() {
    const barberia = useBarberia();
    if (!barberia.logo_url) {
        return <span className="display max-w-full truncate text-xl">{barberia.nombre}</span>;
    }
    return (
        <span className="flex h-8 max-w-32 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host */}
            <img
                src={barberia.logo_url}
                alt={barberia.nombre}
                className={`h-full w-full object-contain ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`}
            />
            {barberia.logo_oscuro_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={barberia.logo_oscuro_url} alt={barberia.nombre} className="hidden h-full w-full object-contain dark:block" />
            )}
        </span>
    );
}

/**
 * Barra de las páginas públicas de una barbería: marca Sunwalk (vuelve a /), nombre de la barbería al centro,
 * y a la derecha `acciones`, tema y login/menú de cuenta. `children` va en una fila bajo la barra (p. ej. el buscador).
 */
export function BarberiaNavbar({
    acciones,
    ancho = "max-w-5xl",
    children,
}: {
    acciones?: React.ReactNode;
    ancho?: string;
    children?: React.ReactNode;
}) {
    const { slug } = useBarberia();
    // Si la barbería fijó claro u oscuro, el visitante no lo cambia
    const modoLibre = useApariencia().tema.modo === "auto";
    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className={`mx-auto px-4 sm:px-6 ${ancho}`}>
                <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Link
                        href="/"
                        className="inline-flex min-h-11 items-center gap-2 justify-self-start"
                        aria-label={`${PLATAFORMA.nombre}, inicio`}
                    >
                        <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground">
                            <Sun className="size-4" />
                        </span>
                        <span className="display hidden text-xl md:inline">{PLATAFORMA.nombre}</span>
                    </Link>
                    <Link href={`/${slug}`} className="flex min-h-11 max-w-[40vw] items-center justify-center sm:max-w-xs">
                        <BarberiaLogo />
                    </Link>
                    <div className="flex items-center gap-1 justify-self-end sm:gap-2">
                        {acciones}
                        {modoLibre && <ModeToggle />}
                        <BarberiaUserMenu />
                    </div>
                </div>
                {children && <div className="pb-3">{children}</div>}
            </div>
        </header>
    );
}
