import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Scissors, Search } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeaderPlataforma } from "@/components/plataforma/header";
import { FooterPlataforma } from "@/components/plataforma/footer";
import { PLATAFORMA } from "@/lib/plataforma";

export const metadata: Metadata = {
  title: `Buscar barberías - ${PLATAFORMA.nombre}`,
  description: "Encuentra tu barbería por nombre o comuna y reserva en línea.",
};

interface Fila {
  slug: string;
  nombre: string;
  eslogan: string | null;
  logo_url: string | null;
  sucursal: { comuna: string; region: string | null; activa: boolean }[];
}

const TODAS = "todas";

// Sin tildes ni mayúsculas: "valparaiso" encuentra "Valparaíso"
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/**
 * HU-19: buscador de barberías por nombre o comuna. Solo aparecen las activas
 * (RLS oculta las suspendidas). Sin coincidencias se muestran las de la región elegida.
 */
export default async function BarberiasPage({ searchParams }: { searchParams: Promise<{ q?: string; region?: string }> }) {
  const { q = "", region = TODAS } = await searchParams;
  const supabase = await createClient();
  // shortcut: filtra en memoria (PostgREST corta en 1000 filas); pasar a una RPC con unaccent cuando haya cientos de barberías
  const { data, error } = await supabase
    .from("barberia")
    .select("slug, nombre, eslogan, logo_url, sucursal (comuna, region, activa)")
    .eq("activa", true)
    .order("nombre");
  if (error) console.error("Error fetching barberías:", error);

  const barberias = ((data ?? []) as Fila[]).map((b) => ({ ...b, sucursal: b.sucursal.filter((s) => s.activa) }));
  const regiones = [...new Set(barberias.flatMap((b) => b.sucursal.map((s) => s.region)).filter((r): r is string => !!r))].sort();

  const texto = normalizar(q);
  const enRegion = region === TODAS ? barberias : barberias.filter((b) => b.sucursal.some((s) => s.region === region));
  const encontradas = texto
    ? enRegion.filter((b) => normalizar(b.nombre).includes(texto) || b.sucursal.some((s) => normalizar(s.comuna).includes(texto)))
    : enRegion;
  const sinCoincidencias = encontradas.length === 0;
  // Sin coincidencias: las barberías activas de la región elegida (o todas si no se eligió una)
  const lista = sinCoincidencias ? enRegion : encontradas;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeaderPlataforma />

      <main id="contenido" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <h1 className="display text-4xl sm:text-5xl md:text-6xl mb-3">Encuentra tu barbería</h1>
        <p className="text-lg mb-8">Busca por nombre o comuna y reserva en línea.</p>

        <form action="/barberias" role="search" className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end mb-8">
          <div className="space-y-2">
            <Label htmlFor="q">Nombre o comuna</Label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Ej. Valdivia" className="h-11 border border-border bg-card" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Región</Label>
            <Select name="region" defaultValue={regiones.includes(region) ? region : TODAS}>
              <SelectTrigger id="region" className="h-11 w-full border border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las regiones</SelectItem>
                {regiones.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="h-11 gap-2 px-6">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </form>

        <div role="status" className="mb-4 text-sm font-medium">
          {sinCoincidencias
            ? lista.length > 0
              ? `No encontramos barberías${q ? ` para "${q}"` : ""}. Estas son las barberías disponibles${region === TODAS ? "" : ` en ${region}`}:`
              : "Todavía no hay barberías disponibles."
            : `${lista.length} ${lista.length === 1 ? "barbería" : "barberías"}`}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((b) => {
            const comunas = [...new Set(b.sucursal.map((s) => s.comuna))];
            return (
              <li key={b.slug}>
                <Link href={`/${b.slug}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="h-full border border-border transition-colors hover:bg-accent">
                    <CardContent className="p-5 flex items-start gap-4">
                      <span className="h-12 w-12 shrink-0 bg-muted flex items-center justify-center overflow-hidden">
                        {b.logo_url
                          // eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host
                          ? <img src={b.logo_url} alt="" className="h-full w-full object-contain" />
                          : <Scissors className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{b.nombre}</span>
                        {b.eslogan && <span className="block text-sm text-muted-foreground line-clamp-2">{b.eslogan}</span>}
                        {comunas.length > 0 && (
                          <span className="mt-2 flex items-center gap-1 text-sm">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {comunas.join(", ")}
                          </span>
                        )}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>

      <FooterPlataforma />
    </div>
  );
}
