import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { LegalLinks } from "@/components/legal-links";
import {
  BarChart3, Calendar, Check, Clock, Globe, LogIn, Mail, ShoppingBag, Scissors, Star, Users,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { caracteristicasPlan, DIAS_PRUEBA, getPlanes } from "@/lib/planes";
import { formatCLP } from "@/lib/datetime";
import { PLATAFORMA } from "@/lib/plataforma";
import { destinoTrasLogin, esSuperadmin, getMembresias } from "@/lib/roles";

const funcionalidades = [
  {
    icon: Calendar,
    titulo: "Agenda online 24/7",
    texto: "Tus clientes eligen barbero, servicio y hora desde el celular. Sin llamadas ni mensajes.",
  },
  {
    icon: Globe,
    titulo: "Tu página propia",
    texto: "Una página con tu logo, galería de trabajos, horario, ubicación y opiniones de clientes.",
  },
  {
    icon: Mail,
    titulo: "Confirmaciones por correo",
    texto: "Cada reserva llega con links para que el cliente la confirme o la cancele con un clic.",
  },
  {
    icon: Star,
    titulo: "Reseñas verificadas",
    texto: "Después de cada cita o compra el cliente recibe un link para calificar. Solo opinan clientes reales.",
  },
  {
    icon: ShoppingBag,
    titulo: "Tienda en línea",
    texto: "Vende ceras, aceites y packs con pago en Mercado Pago, retiro en local o despacho.",
  },
  {
    icon: Users,
    titulo: "Equipo y sucursales",
    texto: "Cada barbero gestiona su horario y servicios. Tú administras usuarios, productos y pedidos.",
  },
  {
    icon: Clock,
    titulo: "Horarios y bloqueos",
    texto: "Define turnos por sucursal y bloquea vacaciones o feriados. La agenda nunca se cruza.",
  },
  {
    icon: BarChart3,
    titulo: "Clientes y estadísticas",
    texto: "Historial por cliente, asistencia, ingresos del mes y bloqueo de clientes que no llegan.",
  },
];

const pasos = [
  { numero: "1", titulo: "Crea tu cuenta", texto: "Regístrate con tu correo en un minuto." },
  { numero: "2", titulo: "Registra tu barbería", texto: "Elige tu plan, tu dirección web y tu primera sucursal." },
  { numero: "3", titulo: "Comparte tu link", texto: "Agrega a tu equipo, define horarios y empieza a recibir reservas." },
];

export default async function PlataformaHome() {
  const supabase = await createClient();
  const [planes, { data: { user } }] = await Promise.all([getPlanes(supabase), supabase.auth.getUser()]);
  // Con sesión: acceso directo a su panel (dashboard o cuenta)
  const miPanel = user
    ? destinoTrasLogin(await getMembresias(supabase, user.id), null, null, await esSuperadmin(supabase, user.id))
    : null;
  // El plan del medio se destaca como recomendado
  const destacado = planes.length >= 3 ? planes[1].id_plan : null;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden selection:bg-primary/20">

      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight">
            <span className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Scissors className="h-4 w-4 text-white dark:text-zinc-900" />
            </span>
            {PLATAFORMA.nombre}
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Cómo funciona</a>
            <a href="#planes" className="hover:text-foreground transition-colors">Planes</a>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href={miPanel ?? "/login"}>
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">{miPanel ? "Mi panel" : "Iniciar Sesión"}</span>
              </Link>
            </Button>
            <Button size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/registro">Registra tu barbería</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main id="contenido" className="relative z-10 pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Hero Section */}
        <section className="flex flex-col items-center text-center mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <Badge variant="outline" className="mb-6 px-6 py-1.5 text-sm uppercase tracking-widest border-primary/20 bg-primary/5">
            Software para barberías
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight mb-6 max-w-4xl bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-400 dark:to-white">
            Tu barbería, con agenda y tienda en línea.
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light mb-10">
            {PLATAFORMA.nombre} le da a tu barbería su propia página para recibir reservas,
            vender productos y conocer a tus clientes. Sin instalar nada.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
              <Link href="/registro">
                Prueba gratis {DIAS_PRUEBA} días
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
              <a href="#planes">Ver planes</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Sin tarjeta de crédito para empezar.</p>
        </section>

        {/* Features */}
        <section id="funcionalidades" className="mb-24 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Todo lo que tu barbería necesita</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Desde la primera reserva hasta la reseña del cliente, en un solo lugar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {funcionalidades.map((f) => (
              <Card key={f.titulo} className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <f.icon className="h-6 w-6 text-zinc-900 dark:text-white" />
                  </div>
                  <h3 className="font-bold mb-2">{f.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.texto}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="como-funciona" className="mb-24 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Empieza en minutos</h2>
            <p className="text-muted-foreground">Tu barbería queda en <span className="font-mono text-foreground">/{"<tu-barberia>"}</span>, lista para compartir.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pasos.map((p) => (
              <div key={p.numero} className="text-center p-6">
                <div className="w-12 h-12 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center text-xl font-black mx-auto mb-4">
                  {p.numero}
                </div>
                <h3 className="font-bold text-lg mb-2">{p.titulo}</h3>
                <p className="text-sm text-muted-foreground">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Barbers */}
        <section className="mb-24">
          <Card className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent">
            <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Scissors className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">¿Eres barbero?</h2>
                  <p className="text-muted-foreground max-w-xl">
                    Crea tu cuenta gratis. Cuando la barbería donde trabajas te invite con tu correo,
                    aceptas la invitación y tendrás tu agenda, tus clientes y tus horarios listos.
                  </p>
                </div>
              </div>
              <Button size="lg" variant="outline" className="h-12 px-8" asChild>
                <Link href="/signup?next=/cuenta">Crear mi cuenta de barbero</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Pricing */}
        <section id="planes" className="mb-24 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Planes simples, sin letra chica</h2>
            <p className="text-muted-foreground">
              Todos los planes incluyen {DIAS_PRUEBA} días de prueba sin tarjeta. Precios mensuales en pesos chilenos [COMPLETAR: IVA incluido o + IVA].
              Cancelas cuando quieras desde tu panel.
            </p>
          </div>
          {planes.length === 0 ? (
            <p className="text-center text-muted-foreground">Los planes no están disponibles en este momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
              {planes.map((plan) => {
                const esDestacado = plan.id_plan === destacado;
                return (
                  <Card
                    key={plan.id_plan}
                    className={`relative flex flex-col ${esDestacado ? "border-2 border-zinc-900 dark:border-white shadow-2xl md:-translate-y-2" : "border-zinc-200 dark:border-zinc-800"}`}
                  >
                    {esDestacado && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4">Recomendado</Badge>
                    )}
                    <CardHeader>
                      <CardTitle className="text-2xl">{plan.nombre}</CardTitle>
                      <CardDescription>{plan.descripcion}</CardDescription>
                      <div className="pt-4">
                        <span className="text-4xl font-black">{formatCLP(plan.precio_mensual)}</span>
                        <span className="text-muted-foreground"> /mes</span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-3 mb-8 flex-1">
                        {caracteristicasPlan(plan).map((c) => (
                          <li key={c} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                      <Button className="w-full" variant={esDestacado ? "default" : "outline"} asChild>
                        <Link href={`/registro?plan=${plan.id_plan}`}>
                          Empezar con {plan.nombre}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Final CTA */}
        <section className="mb-20">
          <Card className="border-none bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 overflow-hidden">
            <CardContent className="p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">¿Listo para llenar tu agenda?</h2>
                <p className="opacity-80">Registra tu barbería hoy y recibe tu primera reserva en línea.</p>
              </div>
              <Button size="lg" variant="secondary" className="h-12 px-8 text-base" asChild>
                <Link href="/registro">
                  Registra tu barbería
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <Separator className="my-12" />

        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {PLATAFORMA.nombre}. {PLATAFORMA.descripcion}.</p>
          <LegalLinks />
          <a href={`mailto:${PLATAFORMA.emailContacto}`} className="hover:text-foreground transition-colors">
            {PLATAFORMA.emailContacto}
          </a>
        </footer>
      </main>
    </div>
  );
}
