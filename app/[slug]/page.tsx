import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { LegalLinks } from "@/components/legal-links";
import { RecentCutsCarousel } from "@/components/recent-cuts-carousel";
import { ReviewsCarousel } from "@/components/reviews/reviews-carousel";
import Link from "next/link";
import { ArrowRight, Clock, Instagram, LogIn, MapPin, ShoppingBag, Star } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getSucursales } from "@/lib/barberia";
import { getBarberiaCached, getModulosCached } from "@/lib/barberia-server";
import { getHorarioResumen, instagramUrl, mapaEmbedUrl, tieneTienda } from "@/lib/barberia-publica";
import { PLATAFORMA } from "@/lib/plataforma";
import { tieneModulo } from "@/lib/modulos";

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
        <h2 className="display mb-8 text-3xl sm:text-4xl">{titulo}</h2>
        {children}
      </div>
    </section>
  );
}

export default async function BarberiaHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const barberia = await getBarberiaCached(slug);
  if (!barberia) notFound();

  const supabase = await createClient();
  const [sucursales, horario, hayProductos, modulos, { data: resumen }] = await Promise.all([
    getSucursales(supabase, barberia.id_barberia),
    getHorarioResumen(supabase, barberia.id_barberia),
    tieneTienda(supabase, barberia.id_barberia),
    getModulosCached(barberia.id_barberia),
    // HU-11: promedio y número de reseñas de la barbería
    supabase.rpc("resumen_resenas", { p_barberia: barberia.id_barberia }).maybeSingle<{ promedio: number | null; total: number }>(),
  ]);
  const conTienda = hayProductos && tieneModulo(modulos, "ecommerce");
  const conAgenda = tieneModulo(modulos, "agenda");

  const principal = sucursales[0];
  const parrafos = (barberia.descripcion ?? "").split(/\n\s*\n/).filter(Boolean);
  const hayResumen = resumen && resumen.total > 0 && resumen.promedio !== null;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={`/${slug}`} className="flex min-h-11 min-w-0 items-center gap-2 font-semibold">
            {barberia.logo_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host */}
                <img src={barberia.logo_url} alt="" className={`h-8 max-w-32 object-contain ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`} />
                {barberia.logo_oscuro_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={barberia.logo_oscuro_url} alt="" className="hidden h-8 max-w-32 object-contain dark:block" />
                )}
                <span className="sr-only">{barberia.nombre}</span>
              </>
            ) : (
              <span className="display truncate text-xl">{barberia.nombre}</span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild variant="ghost" className="h-11 px-3">
              <Link href={`/login?barberia=${slug}`}>
                <LogIn className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Iniciar sesión</span>
                <span className="sr-only sm:hidden">Iniciar sesión</span>
              </Link>
            </Button>
            {conAgenda && (
              <Button asChild className="h-11">
                <Link href={`/${slug}/agendar`}>Reservar</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="contenido">
        {/* Portada: nombre, eslogan y acciones */}
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 md:pb-16 md:pt-16">
          {barberia.logo_url && (
            <div className="mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host */}
              <img src={barberia.logo_url} alt={`Logo ${barberia.nombre}`} className={`h-20 max-w-64 object-contain object-left sm:h-28 ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`} />
              {barberia.logo_oscuro_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={barberia.logo_oscuro_url} alt={`Logo ${barberia.nombre}`} className="hidden h-20 max-w-64 object-contain object-left sm:h-28 dark:block" />
              )}
            </div>
          )}
          <h1 className="display max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
            {barberia.logo_url ? (barberia.eslogan || barberia.nombre) : barberia.nombre}
          </h1>
          {!barberia.logo_url && barberia.eslogan && (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">{barberia.eslogan}</p>
          )}
          {principal && (
            <p className="mt-4 flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {principal.direccion}, {principal.comuna}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {conAgenda ? (
              <Button asChild size="lg" className="h-12 w-full px-6 text-base sm:w-auto">
                <Link href={`/${slug}/agendar`}>Agendar cita <ArrowRight className="size-4" aria-hidden="true" /></Link>
              </Button>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-muted-foreground">
                Las reservas en línea no están disponibles.{" "}
                {barberia.telefono ? `Agenda llamando al ${barberia.telefono}.` : "Contacta a la barbería para agendar."}
              </p>
            )}
            {conTienda && (
              <Button asChild size="lg" variant="outline" className="h-12 w-full px-6 text-base sm:w-auto">
                <Link href={`/${slug}/tienda`}><ShoppingBag className="size-4" aria-hidden="true" /> Ir a la tienda</Link>
              </Button>
            )}
          </div>

          {hayResumen && (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="size-4 fill-current text-foreground" aria-hidden="true" />
              <span className="font-semibold text-foreground">{Number(resumen.promedio).toLocaleString("es-CL", { minimumFractionDigits: 1 })}</span> de 5
              {" · "}{resumen.total} {resumen.total === 1 ? "opinión" : "opiniones"}
            </p>
          )}
        </section>

        {/* Sucursales */}
        {sucursales.length > 1 && (
          <Seccion titulo="Sucursales">
            <div className="grid gap-4 md:grid-cols-2">
              {sucursales.map((s) => (
                <div key={s.id_sucursal} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
                  <div>
                    <h3 className="text-xl font-semibold">{s.nombre}</h3>
                    <p className="mt-1 text-muted-foreground">{s.direccion}, {s.comuna}</p>
                  </div>
                  <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" className="h-11 flex-1">
                      <Link href={`/${slug}/${s.slug}`}>Ver sucursal</Link>
                    </Button>
                    {conAgenda && (
                      <Button asChild className="h-11 flex-1">
                        <Link href={`/${slug}/agendar?sucursal=${s.slug}`}>Agendar aquí</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        {/* Trabajos recientes */}
        {barberia.galeria.length > 0 && (
          <Seccion titulo="Trabajos recientes">
            <div className="mx-auto max-w-3xl">
              <RecentCutsCarousel imagenes={barberia.galeria} />
            </div>
          </Seccion>
        )}

        {/* Sobre nosotros, horario y ubicación */}
        <Seccion titulo={`Sobre ${barberia.nombre}`}>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
              {parrafos.length > 0
                ? parrafos.map((p, i) => <p key={i}>{p}</p>)
                : <p>Agenda tu próxima visita en línea y elige a tu barbero.</p>}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><Clock className="size-5" aria-hidden="true" />Horario</h3>
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

              {principal && (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="p-6">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="size-5" aria-hidden="true" />{sucursales.length > 1 ? "Sucursales" : "Ubicación"}</h3>
                    <ul className="space-y-1 text-muted-foreground">
                      {sucursales.map((s) => (
                        <li key={s.id_sucursal}>
                          {sucursales.length > 1 && (
                            <Link href={`/${slug}/${s.slug}`} className="font-medium text-foreground underline-offset-4 hover:underline">{s.nombre}: </Link>
                          )}
                          {s.direccion}, {s.comuna}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="relative h-56 border-t border-border">
                    <iframe
                      title="Ubicación en Google Maps"
                      src={mapaEmbedUrl(`${principal.direccion}, ${principal.comuna}, Chile`)}
                      width="100%"
                      height="100%"
                      style={{ border: 0, position: "absolute", inset: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Seccion>

        {/* Opiniones */}
        <Seccion titulo="Opiniones de clientes">
          <ReviewsCarousel />
        </Seccion>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-center text-sm sm:px-6">
          {barberia.instagram && (
            <Button asChild variant="outline" className="h-11">
              <Link href={instagramUrl(barberia.instagram)} target="_blank" rel="noopener noreferrer"><Instagram className="size-4" aria-hidden="true" />Instagram</Link>
            </Button>
          )}
          <p className="text-muted-foreground">© {new Date().getFullYear()} {barberia.nombre}</p>
          <p className="text-muted-foreground">
            Reservas con{" "}
            <Link href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">{PLATAFORMA.nombre}</Link>
          </p>
          <LegalLinks className="text-muted-foreground" />
        </div>
      </footer>
    </div>
  );
}
