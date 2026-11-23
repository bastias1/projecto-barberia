import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, Check, Clock, Mail, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import { caracteristicasPlan, DIAS_PRUEBA, getPlanes } from "@/lib/planes";
import { formatCLP } from "@/lib/datetime";
import { PLATAFORMA } from "@/lib/plataforma";
import { resolverAcceso } from "@/lib/acceso";
import { HeaderPlataforma } from "@/components/plataforma/header";
import { FooterPlataforma } from "@/components/plataforma/footer";
import { VistaAgenda, VistaPagina, VistaReserva, VistaTienda } from "@/components/plataforma/pantallas";

const DETALLES = [
  { icon: Mail, titulo: "Confirmación por correo", texto: "Cada reserva llega con links para confirmar o cancelar con un clic." },
  { icon: Star, titulo: "Reseñas verificadas", texto: "Solo opinan clientes que ya tuvieron su cita o recibieron su compra." },
  { icon: Users, titulo: "Equipo y sucursales", texto: "Cada barbero gestiona su horario; tú administras usuarios, productos y pedidos." },
  { icon: Clock, titulo: "Horarios y bloqueos", texto: "Turnos por sucursal, vacaciones y feriados. La agenda nunca se cruza." },
  { icon: BarChart3, titulo: "Clientes y estadísticas", texto: "Historial, asistencia, ingresos del mes y bloqueo de clientes que no llegan." },
  { icon: CalendarCheck, titulo: "Agenda en tiempo real", texto: "Cuando llega o se cancela una reserva, tu agenda se actualiza sola." },
];

const PASOS = [
  { titulo: "Crea tu cuenta", texto: "Con tu correo, en un minuto." },
  { titulo: "Registra tu barbería", texto: "Elige tu plan, tu dirección web y tu primera sucursal." },
  { titulo: "Comparte tu link", texto: "Suma a tu equipo, define horarios y empieza a recibir reservas." },
];

function Seccion({ id, titulo, children, className = "" }: { id?: string; titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        {titulo && <h2 className="display mb-10 max-w-3xl text-3xl sm:text-4xl md:mb-14 md:text-5xl">{titulo}</h2>}
        {children}
      </div>
    </section>
  );
}

export default async function PlataformaHome() {
  const supabase = await createClient();
  const [planes, { data: { user } }] = await Promise.all([getPlanes(supabase), supabase.auth.getUser()]);
  // Con sesión: acceso directo a su panel (dashboard o cuenta)
  const miPanel = user ? (await resolverAcceso(supabase, user.id)).destino : null;
  // El plan del medio se destaca como recomendado
  const destacado = planes.length >= 3 ? planes[1].id_plan : null;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <HeaderPlataforma miPanel={miPanel} />

      <main id="contenido">
        {/* Portada */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:pb-24">
          <div className="enter">
            <h1 className="display text-[2.6rem] sm:text-6xl lg:text-[4.25rem]">
              Agenda online, tienda y página propia para tu barbería
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Tus clientes reservan desde el celular, compran tus productos y dejan su reseña. Tú ves todo en un panel, sin instalar nada.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 w-full px-6 text-base sm:w-auto">
                <Link href="/registro">Prueba gratis {DIAS_PRUEBA} días <ArrowRight className="size-4" aria-hidden="true" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 w-full px-6 text-base sm:w-auto">
                <a href="#planes">Ver planes</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Sin tarjeta de crédito para empezar.</p>
          </div>
          <div className="enter [animation-delay:120ms]">
            <VistaAgenda />
          </div>
        </section>

        {/* Reserva del cliente */}
        <Seccion id="producto" className="border-t border-border bg-muted/40">
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <h2 className="display text-3xl sm:text-4xl md:text-5xl">Tus clientes reservan en menos de un minuto</h2>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Eligen sucursal, barbero, servicio y hora desde el celular, sin crear cuenta y sin escribirte por WhatsApp. Recibes la reserva en tu agenda al instante.
              </p>
              <Button asChild variant="outline" className="mt-7 h-11">
                <Link href="/barberias">Ver barberías en {PLATAFORMA.nombre}</Link>
              </Button>
            </div>
            <VistaReserva />
          </div>
        </Seccion>

        {/* Página propia y tienda */}
        <Seccion titulo="Tu página propia y tu tienda, con tu marca">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <VistaPagina />
              <p className="max-w-md text-muted-foreground">Logo, galería de trabajos, horarios, ubicación y opiniones, en una dirección fácil de compartir.</p>
            </div>
            <div className="space-y-4">
              <VistaTienda />
              <p className="max-w-md text-muted-foreground">Vende ceras, aceites y packs con pago en Mercado Pago, retiro en el local o despacho.</p>
            </div>
          </div>
        </Seccion>

        {/* Detalles */}
        <Seccion titulo="Todo lo demás que tu barbería necesita" className="border-t border-border">
          <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {DETALLES.map((d) => (
              <li key={d.titulo} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-foreground"><d.icon className="size-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="font-semibold">{d.titulo}</h3>
                  <p className="mt-1 text-muted-foreground">{d.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion id="como-funciona" titulo="Empieza en minutos" className="border-t border-border bg-muted/40">
          <ol className="grid gap-8 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="border-t border-foreground/20 pt-5">
                <p className="tabular text-sm text-muted-foreground">Paso {i + 1}</p>
                <h3 className="display mt-2 text-2xl">{p.titulo}</h3>
                <p className="mt-2 text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-muted-foreground">
            Tu barbería queda en <span className="font-mono text-foreground">{PLATAFORMA.nombre.toLowerCase()}.app/tu-barberia</span>, lista para compartir.
          </p>
        </Seccion>

        {/* Barberos */}
        <Seccion>
          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div className="max-w-2xl">
              <h2 className="display text-3xl sm:text-4xl">¿Eres barbero?</h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Crea tu cuenta gratis. Cuando la barbería donde trabajas te invite con tu correo, aceptas la invitación y tendrás tu agenda, tus clientes y tus horarios listos.
              </p>
            </div>
            <Button asChild size="lg" variant="outline" className="h-12 w-full shrink-0 px-6 text-base md:w-auto">
              <Link href="/signup?next=/cuenta">Crear mi cuenta de barbero</Link>
            </Button>
          </div>
        </Seccion>

        <Seccion id="planes" titulo="Planes simples, en pesos chilenos" className="border-t border-border">
          <p className="-mt-6 mb-10 max-w-2xl text-lg text-muted-foreground md:-mt-8">
            Todos los planes incluyen {DIAS_PRUEBA} días de prueba sin tarjeta. Cancelas cuando quieras desde tu panel.
          </p>
          {planes.length === 0 ? (
            <p className="text-muted-foreground">Los planes no están disponibles en este momento.</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {planes.map((plan) => {
                const esDestacado = plan.id_plan === destacado;
                return (
                  <article
                    key={plan.id_plan}
                    className={`lift flex flex-col rounded-2xl border p-6 ${esDestacado ? "border-primary bg-accent/60 dark:bg-accent" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="display text-2xl">{plan.nombre}</h3>
                      {esDestacado && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground">Más elegido</span>}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.descripcion}</p>
                    <p className="mt-6">
                      <span className="display tabular text-4xl">{formatCLP(plan.precio_mensual)}</span>
                      <span className="text-sm text-muted-foreground"> /mes</span>
                    </p>
                    <ul className="mt-6 flex-1 space-y-2.5 border-t border-border pt-5 text-sm">
                      {caracteristicasPlan(plan).map((c) => (
                        <li key={c} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          {c}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-8 h-11 w-full" variant={esDestacado ? "default" : "outline"}>
                      <Link href={`/registro?plan=${plan.id_plan}`}>Empezar con {plan.nombre}</Link>
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion className="border-t border-border">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="display text-3xl sm:text-4xl md:text-5xl">¿Listo para llenar tu agenda?</h2>
              <p className="mt-3 text-lg text-muted-foreground">Registra tu barbería hoy y recibe tu primera reserva en línea.</p>
            </div>
            <Button asChild size="lg" className="h-12 w-full shrink-0 px-6 text-base md:w-auto">
              <Link href="/registro">Registra tu barbería <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          </div>
        </Seccion>
      </main>

      <FooterPlataforma />
    </div>
  );
}
