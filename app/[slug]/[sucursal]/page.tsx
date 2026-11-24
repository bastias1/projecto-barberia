import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarberiaNavbar } from "@/components/barberia-navbar";
import { createClient } from "@/utils/supabase/server";
import { getProfesionalesDeSucursal, getSucursalBySlug, getSucursales } from "@/lib/barberia";
import { getBarberiaCached, getModulosCached } from "@/lib/barberia-server";
import { getHorarioResumen, mapaEmbedUrl } from "@/lib/barberia-publica";
import { tieneModulo } from "@/lib/modulos";

type Params = Promise<{ slug: string; sucursal: string }>;

async function cargar(params: Params) {
  const { slug, sucursal: sucursalSlug } = await params;
  const barberia = await getBarberiaCached(slug);
  if (!barberia) return null;
  const supabase = await createClient();
  const sucursal = await getSucursalBySlug(supabase, barberia.id_barberia, sucursalSlug);
  if (!sucursal) return null;
  return { supabase, barberia, sucursal };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const datos = await cargar(params);
  if (!datos) return {};
  const { barberia, sucursal } = datos;
  return {
    title: `${barberia.nombre} ${sucursal.nombre} - Reservas Online`,
    description: `Agenda tu cita en ${barberia.nombre}, sucursal ${sucursal.nombre}: ${sucursal.direccion}, ${sucursal.comuna}.`,
  };
}

/** Página de una sucursal: dirección, horario, barberos y reserva directa en ella. */
export default async function SucursalPage({ params }: { params: Params }) {
  const datos = await cargar(params);
  if (!datos) notFound();
  const { supabase, barberia, sucursal } = datos;

  const [horario, asignados, { data: profesionales }, sucursales, modulos] = await Promise.all([
    getHorarioResumen(supabase, barberia.id_barberia, sucursal.id_sucursal),
    getProfesionalesDeSucursal(supabase, barberia.id_barberia, sucursal.id_sucursal),
    supabase.rpc("profesionales_publicos", { p_barberia: barberia.id_barberia }),
    getSucursales(supabase, barberia.id_barberia),
    getModulosCached(barberia.id_barberia),
  ]);

  type Profesional = { id_profesional: string; nombre_visible: string; profile_image: string | null; especialidad: string | null };
  const barberos = ((profesionales ?? []) as Profesional[]).filter((p) => asignados.includes(p.id_profesional));
  const otras = sucursales.filter((s) => s.id_sucursal !== sucursal.id_sucursal);
  const agendarHref = `/${barberia.slug}/agendar?sucursal=${sucursal.slug}`;
  const telefono = sucursal.telefono || barberia.telefono;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <BarberiaNavbar
        acciones={tieneModulo(modulos, "agenda") && (
          <Button asChild className="h-11">
            <Link href={agendarHref}>Reservar</Link>
          </Button>
        )}
      />

      <main id="contenido" className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 md:pt-14">
        <section className="mb-12">
          {barberia.logo_url && (
            <div className="mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host */}
              <img src={barberia.logo_url} alt={`Logo ${barberia.nombre}`} className={`h-16 max-w-56 object-contain object-left ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`} />
              {barberia.logo_oscuro_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={barberia.logo_oscuro_url} alt={`Logo ${barberia.nombre}`} className="hidden h-16 max-w-56 object-contain object-left dark:block" />
              )}
            </div>
          )}
          <h1 className="display text-4xl sm:text-5xl">{sucursal.nombre}</h1>
          <p className="mt-3 flex items-center gap-2 text-lg text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {sucursal.direccion}, {sucursal.comuna}
          </p>
          <div className="mt-8">
            {tieneModulo(modulos, "agenda") ? (
              <Button asChild size="lg" className="h-12 w-full px-6 text-base sm:w-auto">
                <Link href={agendarHref}><Calendar className="size-4" aria-hidden="true" />Agendar en {sucursal.nombre}</Link>
              </Button>
            ) : (
              <p className="text-muted-foreground">Reservas en línea no disponibles por ahora.</p>
            )}
          </div>
        </section>

        <div className="mb-12 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Clock className="size-5" aria-hidden="true" />Horario</h2>
              {horario.length === 0 ? (
                <p className="text-muted-foreground">Consulta la disponibilidad al agendar.</p>
              ) : (
                <dl className="space-y-2">
                  {horario.map((tramo) => (
                    <div key={tramo.dias} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{tramo.dias}</dt>
                      <dd className="tabular font-medium">{tramo.horas}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {telefono && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-3 flex items-center gap-2 font-semibold"><Phone className="size-5" aria-hidden="true" />Contacto</h2>
                <a href={`tel:${telefono.replace(/\s/g, "")}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {telefono}
                </a>
              </div>
            )}
          </div>

          <div className="relative min-h-72 overflow-hidden rounded-2xl border border-border lg:col-span-2">
            <iframe
              title={`Ubicación de ${sucursal.nombre} en Google Maps`}
              src={mapaEmbedUrl(`${sucursal.direccion}, ${sucursal.comuna}, Chile`)}
              width="100%"
              height="100%"
              style={{ border: 0, position: "absolute", inset: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        <section className="mb-12">
          <h2 className="display mb-6 text-3xl">Equipo en {sucursal.nombre}</h2>
          {barberos.length === 0 ? (
            <p className="text-muted-foreground">Pronto tendremos barberos disponibles en esta sucursal.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {barberos.map((b) => (
                <div key={b.id_profesional} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                  <Avatar className="size-14">
                    <AvatarImage src={b.profile_image || undefined} alt="" />
                    <AvatarFallback className="bg-muted font-semibold text-foreground">
                      {b.nombre_visible.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.nombre_visible}</p>
                    {b.especialidad && <p className="truncate text-sm text-muted-foreground">{b.especialidad}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {otras.length > 0 && (
          <section className="border-t border-border pt-8">
            <h2 className="mb-4 text-lg font-semibold">Otras sucursales de {barberia.nombre}</h2>
            <div className="flex flex-wrap gap-3">
              {otras.map((s) => (
                <Button key={s.id_sucursal} asChild variant="outline" className="h-11 gap-2">
                  <Link href={`/${barberia.slug}/${s.slug}`}><MapPin className="size-4" aria-hidden="true" />{s.nombre}</Link>
                </Button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
