"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBarberia } from "@/components/barberia-provider";
import { DEFAULT_TZ, formatPlazo } from "@/lib/barberia";
import { formatCLP, formatFecha, toZoned } from "@/lib/datetime";
import { getBarberos } from "@/lib/services/barber-service";
import { one } from "@/lib/utils";
import { cambiarReserva } from "@/app/[slug]/reprogramar/actions";
import { Vidrio } from "@/components/vidrio";

interface Reserva {
    id: number;
    inicio: string;
    estado: string;
    monto: number;
    servicio: string;
    barbero: string;
    sucursal: string;
    tz: string;
    modificable: boolean; // pendiente o confirmada y aún no pasa (el plazo lo decide la BD)
}

const ESTADOS: Record<string, string> = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    completada: "Completada",
    cancelada: "Cancelada",
    no_asistio: "No asistió",
};

async function cargarReservas(idBarberia: string): Promise<Reserva[]> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const [{ data, error }, barberos] = await Promise.all([
            supabase
                .from("reserva")
                .select(`
                    id_reserva, id_profesional, fecha_hora_inicio, estado, monto,
                    servicio:servicio!reserva_servicio_fkey (nombre),
                    sucursal:sucursal!reserva_sucursal_fkey (nombre, zona_horaria)
                `)
                .eq("id_barberia", idBarberia)
                .eq("id_cliente", user.id)
                .order("fecha_hora_inicio", { ascending: false })
                .limit(50),
            getBarberos(idBarberia).catch(() => []),
        ]);
        if (error) console.error("Error fetching bookings:", error);
        return (data ?? []).map((r) => {
            const sucursal = one<{ nombre: string; zona_horaria: string }>(r.sucursal);
            return {
                id: r.id_reserva,
                inicio: r.fecha_hora_inicio,
                estado: r.estado,
                monto: Number(r.monto),
                servicio: one<{ nombre: string }>(r.servicio)?.nombre ?? "Servicio",
                barbero: barberos.find((b) => b.id === r.id_profesional)?.nombre ?? "Barbero",
                sucursal: sucursal?.nombre ?? "",
                tz: sucursal?.zona_horaria || DEFAULT_TZ,
                modificable: ["pendiente", "confirmada"].includes(r.estado) && Date.parse(r.fecha_hora_inicio) > Date.now(),
            };
        });
}

/** HU-22: reservas del cliente en esta barbería, con cancelar y reprogramar. */
export function BookingHistory() {
    const barberia = useBarberia();
    const [reservas, setReservas] = useState<Reserva[] | null>(null);
    const [cancelando, setCancelando] = useState<number | null>(null);

    useEffect(() => {
        cargarReservas(barberia.id_barberia).then(setReservas);
    }, [barberia.id_barberia]);

    const cancelar = async (id: number) => {
        setCancelando(id);
        const result = await cambiarReserva({ id });
        setCancelando(null);
        if (!result.success) return toast.error(result.error);
        toast.success("Cita cancelada");
        setReservas(await cargarReservas(barberia.id_barberia));
    };

    if (!reservas) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    if (reservas.length === 0) {
        return (
            <div className="text-center py-12 space-y-4">
                <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">Aún no tienes reservas con tu cuenta en {barberia.nombre}.</p>
                <Button asChild><Link href={`/${barberia.slug}/agendar`}>Agendar una cita</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Puedes cancelar o cambiar la hora hasta {formatPlazo(barberia.plazo_cancelacion_min)} antes de la cita.
            </p>
            <ul className="space-y-3">
                {reservas.map((r) => {
                    const { fecha, hora } = toZoned(r.inicio, r.tz);
                    return (
                        <li key={r.id}>
                            <Card>
                              <Vidrio />
                                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold">{r.servicio} con {r.barbero}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatFecha(fecha, "EEEE d 'de' MMMM yyyy")}, {hora}{r.sucursal && ` · ${r.sucursal}`} · {formatCLP(r.monto)}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={r.estado === "cancelada" || r.estado === "no_asistio" ? "outline" : "secondary"}>
                                            {ESTADOS[r.estado] ?? r.estado}
                                        </Badge>
                                        {r.modificable && (
                                            <>
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/${barberia.slug}/reprogramar?id=${r.id}`}>Cambiar la hora</Link>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm" disabled={cancelando === r.id}>Cancelar</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {r.servicio} con {r.barbero}, {formatFecha(fecha, "EEEE d 'de' MMMM")} a las {hora}. El horario quedará libre para otra persona.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Volver</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => cancelar(r.id)}>Sí, cancelar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
