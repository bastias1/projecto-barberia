import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, MapPin, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { createClient } from "@/utils/supabase/server";
import { getProfesionalesDeSucursal, getSucursalBySlug, getSucursales } from "@/lib/barberia";
import { getBarberiaCached, getModulosCached } from "@/lib/barberia-server";
import { getHorarioResumen, mapaEmbedUrl } from "@/lib/barberia-publica";

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
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${barberia.slug}`}>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="truncate max-w-48">{barberia.nombre}</span>
            </Button>
          </Link>
          <ModeToggle />
        </div>
      </nav>

      <main id="contenido" className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Hero */}
        <section className="flex flex-col items-center text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {barberia.logo_url && (
            <div className="h-20 sm:h-24 mb-6 flex items-center justify-center">
              <img
                src={barberia.logo_url}
                alt={`Logo ${barberia.nombre}`}
                className={`max-h-full object-contain ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`}
              />
              {barberia.logo_oscuro_url && (
                <img src={barberia.logo_oscuro_url} alt={`Logo ${barberia.nombre}`} className="max-h-full object-contain hidden dark:block" />
              )}
            </div>
          )}
          <Badge variant="outline" className="mb-4 px-4 py-1 uppercase tracking-widest">
            Sucursal
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">{sucursal.nombre}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mb-8">
            <MapPin className="h-4 w-4" />
            {sucursal.direccion}, {sucursal.comuna}
          </p>
          {modulos.includes("agenda") ? (
            <Link href={agendarHref}>
              <Button size="lg" className="h-12 px-8 text-base gap-2">
                <Calendar className="h-5 w-5" />
                Agendar en {sucursal.nombre}
              </Button>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Reservas en línea no disponibles por ahora.</p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Horario + contacto */}
          <div className="space-y-6">
            <Card className="border-none bg-zinc-50 dark:bg-zinc-900/50">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background shadow-sm">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-bold text-lg mb-1">Horario</h2>
                  {horario.length === 0 ? (
                    <p className="text-muted-foreground">Consulta disponibilidad al agendar</p>
                  ) : (
                    horario.map((tramo) => (
                      <div key={tramo.dias}>
                        <p className="text-muted-foreground">{tramo.dias}</p>
                        <p className="font-medium text-lg">{tramo.horas}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {telefono && (
              <Card className="border-none bg-zinc-50 dark:bg-zinc-900/50">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-background shadow-sm">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg mb-1">Contacto</h2>
                    <a href={`tel:${telefono.replace(/\s/g, "")}`} className="text-muted-foreground hover:text-foreground">
                      {telefono}
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Mapa */}
          <Card className="lg:col-span-2 border-none bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden min-h-[280px] relative">
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
          </Card>
        </div>

        {/* Barberos */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <Users className="h-5 w-5" />
            Nuestro equipo en {sucursal.nombre}
          </h2>
          {barberos.length === 0 ? (
            <p className="text-muted-foreground">Pronto tendremos barberos disponibles en esta sucursal.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {barberos.map((b) => (
                <Card key={b.id_profesional} className="border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-5 flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={b.profile_image || undefined} alt={b.nombre_visible} />
                      <AvatarFallback className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold">
                        {b.nombre_visible.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{b.nombre_visible}</p>
                      {b.especialidad && <p className="text-sm text-muted-foreground truncate">{b.especialidad}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Otras sucursales */}
        {otras.length > 0 && (
          <section className="border-t pt-8">
            <h2 className="text-lg font-semibold mb-4">Otras sucursales de {barberia.nombre}</h2>
            <div className="flex flex-wrap gap-3">
              {otras.map((s) => (
                <Link key={s.id_sucursal} href={`/${barberia.slug}/${s.slug}`}>
                  <Button variant="outline" className="gap-2">
                    <MapPin className="h-4 w-4" />
                    {s.nombre}
                  </Button>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
