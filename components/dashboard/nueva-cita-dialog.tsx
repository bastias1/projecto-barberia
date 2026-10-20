"use client"

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBarberia } from "@/components/barberia-provider";
import { crearCitaManual } from "@/app/[slug]/dashboard/citas/actions";
import { silenciarAvisosDeReservas } from "@/components/dashboard/reservas-realtime";
import { getServicesByBarber, type Service } from "@/lib/services/service-service";
import { getAvailableTimeSlots, type TimeSlot } from "@/lib/services/booking-service";
import { DEFAULT_TZ, type Sucursal } from "@/lib/barberia";
import { formatCLP, localDateString, todayIn } from "@/lib/datetime";

interface NuevaCitaDialogProps {
  barberoId: string;
  sucursales: Sucursal[]; // las asignadas al barbero
  fechaInicial: Date;
  onCreada: (fecha: Date) => void;
}

const CLIENTE_VACIO = { nombre: "", apellido: "", correo: "", telefono: "" };

/** Cita registrada por el barbero: reservas por teléfono o clientes que llegan sin hora. */
export function NuevaCitaDialog({ barberoId, sucursales, fechaInicial, onCreada }: NuevaCitaDialogProps) {
  const barberia = useBarberia();
  const [open, setOpen] = useState(false);
  const [servicios, setServicios] = useState<Service[]>([]);
  const [idSucursal, setIdSucursal] = useState<string>(sucursales.length === 1 ? String(sucursales[0].id_sucursal) : "");
  const [idServicio, setIdServicio] = useState<string>("");
  const [fecha, setFecha] = useState<Date>(fechaInicial);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [hora, setHora] = useState("");
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [privacidad, setPrivacidad] = useState(false);
  const [confirmar, setConfirmar] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const servicio = servicios.find((s) => String(s.id) === idServicio);
  const hoy = new Date(`${todayIn(DEFAULT_TZ)}T00:00:00`);

  // Al abrir, parte en el día que se está viendo en la agenda
  useEffect(() => {
    if (open) setFecha(fechaInicial < hoy ? hoy : fechaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Servicios que hace el barbero
  useEffect(() => {
    if (!open || servicios.length > 0) return;
    getServicesByBarber(barberia.id_barberia, barberoId)
      .then(setServicios)
      .catch(() => toast.error("No se pudieron cargar tus servicios"));
  }, [open, servicios.length, barberia.id_barberia, barberoId]);

  // Turnos libres (sin anticipación mínima: puede ser para ahora mismo)
  useEffect(() => {
    if (!open || !servicio || !idSucursal) {
      setSlots([]);
      return;
    }
    let vigente = true;
    setCargandoSlots(true);
    getAvailableTimeSlots(barberia.id_barberia, fecha, barberoId, servicio.duracion, Number(idSucursal), 0)
      .then((data) => {
        if (!vigente) return;
        setSlots(data);
        setHora((h) => (data.some((s) => s.hora === h) ? h : ""));
      })
      .finally(() => vigente && setCargandoSlots(false));
    return () => {
      vigente = false;
    };
  }, [open, servicio, idSucursal, fecha, barberia.id_barberia, barberoId]);

  const reiniciar = () => {
    setIdServicio("");
    setHora("");
    setCliente(CLIENTE_VACIO);
    setPrivacidad(false);
    setConfirmar(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slot = slots.find((s) => s.hora === hora);
    if (!servicio || !slot) {
      toast.error("Elige el servicio y la hora");
      return;
    }

    setEnviando(true);
    silenciarAvisosDeReservas();
    try {
      const result = await crearCitaManual({
        slug: barberia.slug,
        barberoId,
        serviceId: servicio.id,
        idSucursal: slot.idSucursal,
        fecha: localDateString(fecha),
        hora: slot.hora,
        customerInfo: {
          firstName: cliente.nombre,
          lastName: cliente.apellido,
          email: cliente.correo,
          phone: cliente.telefono,
        },
        aceptaPrivacidad: privacidad,
        confirmar,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Cita agendada: ${format(fecha, "EEE d MMM", { locale: es })} · ${slot.hora}`);
      onCreada(fecha);
      reiniciar();
      setOpen(false);
    } catch (error) {
      console.error("Error creating manual booking:", error);
      toast.error("No se pudo agendar la cita");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva cita</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nueva cita</DialogTitle>
            <DialogDescription>Para reservas por teléfono o clientes que llegan sin hora.</DialogDescription>
          </DialogHeader>

          {sucursales.length > 1 && (
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={idSucursal} onValueChange={setIdSucursal}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige la sucursal" /></SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id_sucursal} value={String(s.id_sucursal)}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={idServicio} onValueChange={setIdServicio}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Elige el servicio" /></SelectTrigger>
              <SelectContent>
                {servicios.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre} · {s.duracion} min · {formatCLP(s.precio)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start gap-2 font-normal">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="capitalize">{format(fecha, "EEE d MMM", { locale: es })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    required
                    selected={fecha}
                    onSelect={(d) => d && setFecha(d)}
                    defaultMonth={fecha}
                    locale={es}
                    weekStartsOn={1}
                    disabled={{ before: hoy }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Select value={hora} onValueChange={setHora} disabled={!servicio || !idSucursal || cargandoSlots || slots.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      cargandoSlots ? "Buscando..." : !servicio || !idSucursal ? "Elige servicio" : slots.length === 0 ? "Sin horas libres" : "Elige la hora"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.hora} value={s.hora}>{s.hora}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Nombre" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} required maxLength={60} />
              <Input placeholder="Apellido" value={cliente.apellido} onChange={(e) => setCliente({ ...cliente, apellido: e.target.value })} required maxLength={60} />
            </div>
            <Input
              type="email"
              placeholder="Correo (recibe la confirmación)"
              value={cliente.correo}
              onChange={(e) => setCliente({ ...cliente, correo: e.target.value })}
              required
              maxLength={120}
            />
            <Input
              type="tel"
              placeholder="Teléfono (opcional)"
              value={cliente.telefono}
              onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
              maxLength={30}
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={privacidad} onCheckedChange={(v) => setPrivacidad(v === true)} className="mt-0.5" />
              <span>El cliente aceptó la política de privacidad</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmar} onCheckedChange={(v) => setConfirmar(v === true)} className="mt-0.5" />
              <span>Marcar como confirmada</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !privacidad || !hora}>
              {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
