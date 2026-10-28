"use client"

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";

/** Búsqueda en la URL (?q=), vuelve a la primera página al escribir. */
export function Buscador({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const buscar = useDebouncedCallback((texto: string) => {
    const params = new URLSearchParams(searchParams);
    if (texto) params.set("q", texto);
    else params.delete("q");
    params.delete("pagina");
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="relative w-full sm:w-80">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className="pl-9"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => buscar(e.target.value)}
      />
    </div>
  );
}
