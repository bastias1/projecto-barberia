"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";

export interface EnlaceNav {
  href: string;
  label: string;
}

/** Menú de pantalla completa para teléfono: enlaces grandes (>=44px), tema y acceso. */
export function MenuMovil({ enlaces, miPanel }: { enlaces: EnlaceNav[]; miPanel: string | null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="size-11 md:hidden">
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="h-dvh w-full max-w-none gap-0 border-0 bg-background p-0 [&>button]:hidden">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <SheetTitle className="display text-xl">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navegación de la plataforma</SheetDescription>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <SheetClose asChild>
              <Button variant="outline" size="icon" className="size-11">
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Cerrar menú</span>
              </Button>
            </SheetClose>
          </div>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {enlaces.map((e) => (
            <SheetClose asChild key={e.href}>
              <Link href={e.href} className="display flex min-h-16 items-center border-b border-border text-3xl">
                {e.label}
              </Link>
            </SheetClose>
          ))}
          <div className="mt-auto grid gap-3 pt-6">
            <Button asChild size="lg" className="h-12 text-base">
              <Link href="/registro" onClick={() => setAbierto(false)}>Prueba gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 text-base">
              <Link href={miPanel ?? "/login"} onClick={() => setAbierto(false)}>{miPanel ? "Mi panel" : "Iniciar sesión"}</Link>
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
