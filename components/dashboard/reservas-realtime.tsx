"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { DEFAULT_TZ } from "@/lib/barberia";
import { formatFecha, toZoned } from "@/lib/datetime";

// Mientras el barbero agenda desde "Nueva cita" ese formulario ya avisa: el
// evento de Realtime puede llegar antes que la respuesta, por eso es por tiempo
let silencioHasta = 0;

export function silenciarAvisosDeReservas(ms = 15_000) {
  silencioHasta = Date.now() + ms;
}

const silenciado = () => Date.now() < silencioHasta;

type ReservaRow = { id_reserva: number; estado: string; fecha_hora_inicio: string };

/**
 * Escucha las reservas del barbero (Supabase Realtime, filtrado por RLS):
 * avisa de las nuevas y de las canceladas, y refresca la vista para que la
 * agenda y los contadores se actualicen sin recargar.
 */
export function ReservasRealtime({ profesionalId }: { profesionalId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Varias filas seguidas (p. ej. reserva + confirmación) -> un solo refresco
    const refrescar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const cuando = (row: ReservaRow) => {
      const { fecha, hora } = toZoned(row.fecha_hora_inicio, DEFAULT_TZ);
      return `${formatFecha(fecha, "EEE d MMM")} · ${hora}`;
    };

    const canal = supabase
      .channel(`reservas-${profesionalId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reserva", filter: `id_profesional=eq.${profesionalId}` },
        (payload) => {
          const row = payload.new as ReservaRow;
          if (!silenciado()) {
            toast.info(`Nueva reserva: ${cuando(row)}`);
          }
          refrescar();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reserva", filter: `id_profesional=eq.${profesionalId}` },
        (payload) => {
          const row = payload.new as ReservaRow;
          if (row.estado === "cancelada" && !silenciado()) {
            toast.warning(`Se canceló la cita del ${cuando(row)}`);
          }
          refrescar();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [profesionalId, router]);

  return null;
}
