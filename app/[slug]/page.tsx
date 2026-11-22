import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { LegalLinks } from "@/components/legal-links";
import { RecentCutsCarousel } from "@/components/recent-cuts-carousel";
import { ReviewsCarousel } from "@/components/reviews/reviews-carousel";
import Link from "next/link";
import { Calendar, ShoppingBag, Clock, MapPin, Instagram, LogIn, Scissors, Star } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getSucursales } from "@/lib/barberia";
import { getBarberiaCached, getModulosCached } from "@/lib/barberia-server";
import { getHorarioResumen, instagramUrl, mapaEmbedUrl, tieneTienda } from "@/lib/barberia-publica";
import { PLATAFORMA } from "@/lib/plataforma";
import { tieneModulo } from "@/lib/modulos";

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

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden selection:bg-primary/20">

      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={`/login?barberia=${slug}`}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>
      </nav>

      <main id="contenido" className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mb-16 lg:mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {barberia.logo_url && (
            <div className="relative w-full max-w-3xl mx-auto mb-8">
              <div className="aspect-[3/1] relative flex items-center justify-center">
                <img
                  src={barberia.logo_url}
                  alt={`Logo ${barberia.nombre}`}
                  className={`h-32 sm:h-48 object-contain drop-shadow-2xl ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`}
                />
                {barberia.logo_oscuro_url && (
                  <img
                    src={barberia.logo_oscuro_url}
                    alt={`Logo ${barberia.nombre}`}
                    className="h-32 sm:h-48 object-contain hidden dark:block drop-shadow-2xl"
                  />
                )}
              </div>
            </div>
          )}

          <Badge variant="outline" className="mb-6 px-6 py-1.5 text-sm uppercase tracking-widest border-primary/20 bg-primary/5">
            {principal ? `Barbería · ${principal.comuna}` : "Barbería"}
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-400 dark:to-white">
            {barberia.logo_url ? (barberia.eslogan || barberia.nombre) : barberia.nombre}
          </h1>

          {!barberia.logo_url && barberia.eslogan && (
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              {barberia.eslogan}
            </p>
          )}
        </div>

        {/* Primary Actions Grid */}
        <div className={`grid grid-cols-1 gap-4 lg:gap-6 mb-16 mx-auto ${conTienda ? "md:grid-cols-2 max-w-4xl" : "max-w-md"}`}>
          {/* Booking Card */}
          {conAgenda ? (
          <Link href={`/${slug}/agendar`} className="group h-full">
            <Card className="h-full overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 group-hover:border-primary/50 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-6 flex flex-col items-center text-center h-full justify-center relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <Calendar className="h-8 w-8 text-zinc-900 dark:text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">Agendar Cita</h3>
                <p className="text-sm text-muted-foreground mb-4">Reserva tu momento de cuidado personal en segundos.</p>
                <div className="mt-auto flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  Reservar Ahora <span className="ml-2">→</span>
                </div>
              </CardContent>
            </Card>
          </Link>
          ) : (
            <Card className="h-full border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent">
              <CardContent className="p-6 flex flex-col items-center text-center h-full justify-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">Reservas en línea no disponibles</h3>
                <p className="text-sm text-muted-foreground">
                  {barberia.telefono ? `Agenda llamando al ${barberia.telefono}.` : "Contacta a la barbería para agendar."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Store Card */}
          {conTienda && (
            <Link href={`/${slug}/tienda`} className="group h-full">
              <Card className="h-full overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 group-hover:border-blue-500/50 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="p-6 flex flex-col items-center text-center h-full justify-center relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                    <ShoppingBag className="h-8 w-8 text-zinc-900 dark:text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-blue-500 transition-colors">Tienda Online</h3>
                  <p className="text-sm text-muted-foreground mb-4">Productos premium seleccionados para tu rutina.</p>
                  <div className="mt-auto flex items-center text-sm font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    Ver Productos <span className="ml-2">→</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Branches Section */}
        {sucursales.length > 1 && (
          <div className="mb-20">
            <div className="flex items-center justify-center mb-8 px-2">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Nuestras Sucursales
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {sucursales.map((s) => (
                <Card key={s.id_sucursal} className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
                  <CardContent className="p-6 flex flex-col gap-4 h-full">
                    <div>
                      <h3 className="text-xl font-bold">{s.nombre}</h3>
                      <p className="text-sm text-muted-foreground">{s.direccion}, {s.comuna}</p>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <Link href={`/${slug}/${s.slug}`} className="flex-1">
                        <Button variant="outline" className="w-full">Ver sucursal</Button>
                      </Link>
                      {conAgenda && (
                        <Link href={`/${slug}/agendar?sucursal=${s.slug}`} className="flex-1">
                          <Button className="w-full">Agendar aquí</Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Cuts Section */}
        {barberia.galeria.length > 0 && (
          <div className="mb-20">
            <div className="flex items-center justify-between mb-8 px-2 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                Trabajos Recientes
              </h2>
              <Badge variant="secondary">Galería</Badge>
            </div>
            <div className="max-w-3xl mx-auto">
              <RecentCutsCarousel imagenes={barberia.galeria} />
            </div>
          </div>
        )}

        {/* Bento Grid Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">

          {/* About Section - Spans 2 cols */}
          <Card className="lg:col-span-2 border-none bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-32 bg-zinc-200/50 dark:bg-zinc-800/20 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-zinc-300/50 dark:group-hover:bg-zinc-700/20" />
            <CardContent className="p-5 sm:p-8 relative z-10 h-full flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-bold tracking-wider text-sm uppercase">Sobre Nosotros</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
                Sobre {barberia.nombre}
              </h3>
              <div className="space-y-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                {parrafos.length > 0
                  ? parrafos.map((p, i) => <p key={i}>{p}</p>)
                  : <p>Agenda tu próxima visita en línea y elige a tu barbero.</p>}
              </div>
            </CardContent>
          </Card>

          {/* Info Stack - Spans 1 col */}
          <div className="space-y-6 flex flex-col h-full">
            {/* Hours */}
            <Card className="flex-1 border-none bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <CardContent className="p-6 flex items-start gap-4 h-full">
                <div className="p-3 rounded-xl bg-background shadow-sm">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-lg mb-1">Horario</h4>
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

            {/* Location */}
            {principal && (
              <Card className="flex-[2] border-none bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors overflow-hidden">
                <CardContent className="p-0 h-full flex flex-col">
                  <div className="p-6 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-background shadow-sm">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-lg mb-1">{sucursales.length > 1 ? "Sucursales" : "Ubicación"}</h4>
                      {sucursales.map((s) => (
                        <p key={s.id_sucursal} className="text-muted-foreground">
                          {sucursales.length > 1 && (
                            <Link href={`/${slug}/${s.slug}`} className="font-medium text-foreground hover:underline underline-offset-4">
                              {s.nombre}:{" "}
                            </Link>
                          )}
                          {s.direccion}, {s.comuna}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-[150px] relative grayscale hover:grayscale-0 transition-all duration-500">
                    <iframe
                      title="Ubicación en Google Maps"
                      src={mapaEmbedUrl(`${principal.direccion}, ${principal.comuna}, Chile`)}
                      width="100%"
                      height="100%"
                      style={{ border: 0, position: 'absolute', inset: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mb-20">
          <div className="flex flex-col items-center justify-center gap-1 mb-8 px-2 max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" aria-hidden="true" />
              Opiniones de Clientes
            </h2>
            {resumen && resumen.total > 0 && resumen.promedio !== null && (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{Number(resumen.promedio).toLocaleString("es-CL", { minimumFractionDigits: 1 })}</span> de 5
                {" · "}{resumen.total} {resumen.total === 1 ? "opinión" : "opiniones"}
              </p>
            )}
          </div>
          <div className="max-w-5xl mx-auto">
            <ReviewsCarousel />
          </div>
        </div>

        <Separator className="my-12" />

        {/* Footer Section */}
        <footer className="flex flex-col items-center justify-center gap-8 pb-8">
          {barberia.instagram && (
            <div className="flex gap-6">
              <Link href={instagramUrl(barberia.instagram)} target="_blank" className="group" aria-label="Instagram">
                <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-900 group-hover:bg-pink-600 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:shadow-pink-600/20">
                  <Instagram className="h-6 w-6" />
                </div>
              </Link>
            </div>
          )}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              © {new Date().getFullYear()} {barberia.nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              Reservas con{" "}
              <Link href="/" className="underline-offset-4 hover:underline">{PLATAFORMA.nombre}</Link>
            </p>
            <LegalLinks className="pt-2 text-xs text-muted-foreground" />
          </div>
        </footer>

      </main>
    </div>
  );
}
