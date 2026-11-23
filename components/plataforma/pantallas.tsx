import { CalendarDays, MapPin, Package, Scissors } from "lucide-react";

// Vistas de la interfaz hechas en HTML con los mismos tokens de la app: quedan nítidas y correctas en
// claro y oscuro. Los nombres y datos son ficticios.

export function MarcoApp({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-3" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
      </div>
      {children}
    </div>
  );
}

const ESTADO: Record<string, string> = {
  Confirmada: "bg-brand text-brand-foreground",
  Pendiente: "bg-secondary text-secondary-foreground",
  Completada: "bg-muted text-muted-foreground",
};

export function VistaAgenda() {
  const citas = [
    { h: "10:00", n: "Cliente 1", s: "Corte clásico · Matías", e: "Confirmada" },
    { h: "10:45", n: "Cliente 2", s: "Corte y barba · Camilo", e: "Pendiente" },
    { h: "11:30", n: "Cliente 3", s: "Perfilado de barba · Matías", e: "Confirmada" },
    { h: "12:15", n: "Cliente 4", s: "Corte clásico · Camilo", e: "Completada" },
  ];
  return (
    <MarcoApp>
      <div className="flex items-center justify-between px-5 py-4">
        <p className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4" aria-hidden="true" /> Agenda de hoy</p>
        <p className="text-sm text-muted-foreground">4 citas</p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {citas.map((c) => (
          <li key={c.h} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-5 py-3.5">
            <span className="tabular text-lg font-semibold">{c.h}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.n}</span>
              <span className="block truncate text-sm text-muted-foreground">{c.s}</span>
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO[c.e]}`}>{c.e}</span>
          </li>
        ))}
      </ul>
    </MarcoApp>
  );
}

export function VistaReserva() {
  const horas = ["10:00", "10:45", "11:30", "12:15", "15:00", "15:45"];
  return (
    <MarcoApp className="mx-auto w-full max-w-sm">
      <div className="space-y-5 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Barbería Ejemplo</p>
          <p className="display text-2xl">Elige tu hora</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="grid size-10 place-items-center rounded-md bg-brand text-brand-foreground"><Scissors className="size-4" aria-hidden="true" /></span>
          <div className="text-sm">
            <p className="font-medium">Corte clásico</p>
            <p className="tabular text-muted-foreground">45 min · $12.000</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {horas.map((h, i) => (
            <span key={h} className={`tabular grid min-h-11 place-items-center rounded-lg border text-sm font-medium ${i === 1 ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{h}</span>
          ))}
        </div>
        <div className="grid min-h-12 place-items-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">Confirmar reserva</div>
      </div>
    </MarcoApp>
  );
}

export function VistaTienda() {
  const productos = [
    { n: "Cera mate", p: "$9.990" },
    { n: "Aceite de barba", p: "$12.990" },
    { n: "Pack de cuidado", p: "$24.990" },
  ];
  return (
    <MarcoApp>
      <div className="grid grid-cols-3 gap-3 p-4">
        {productos.map((x) => (
          <div key={x.n} className="space-y-2">
            <span className="grid aspect-square place-items-center rounded-lg bg-muted"><Package className="size-6 text-muted-foreground" aria-hidden="true" /></span>
            <p className="truncate text-sm font-medium">{x.n}</p>
            <p className="tabular text-sm text-muted-foreground">{x.p}</p>
          </div>
        ))}
      </div>
    </MarcoApp>
  );
}

export function VistaPagina() {
  return (
    <MarcoApp>
      <div className="space-y-3 p-5">
        <p className="display text-3xl">Barbería Ejemplo</p>
        <p className="tabular text-sm text-muted-foreground">sunwalk.app/tu-barberia</p>
        <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Sucursal Centro · Lun a Sáb 10:00 a 19:00</p>
      </div>
    </MarcoApp>
  );
}
