"use client"

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BarberiaNavbar } from "@/components/barberia-navbar";
import { BarberSelection } from "@/components/booking/barber-selection";
import { ServiceSelection } from "@/components/booking/service-selection";
import { DateTimeSelection } from "@/components/booking/date-time-selection";
import { ContactForm } from "@/components/booking/contact-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { ProgressSteps } from "@/components/booking/progress-steps";
import { AccionesPaso } from "@/components/booking/acciones-paso";
import { SucursalSelection } from "@/components/booking/sucursal-selection";
import { getBarberos, Barbero } from "@/lib/services/barber-service";
import { getServicesByBarber, Service } from "@/lib/services/service-service";
import { getAvailableTimeSlots, getProximaFechaDisponible, TimeSlot } from "@/lib/services/booking-service";
import { crearReserva } from "./actions";
import { localDateString } from "@/lib/datetime";
import { getSucursales, type Sucursal } from "@/lib/barberia";
import { createClient } from "@/utils/supabase/client";
import { useBarberia, useBarberiaHref } from "@/components/barberia-provider";
import { BlockedClientModal } from "@/components/booking/blocked-client-modal";
import { RequiereModulo } from "@/components/requiere-modulo";
import { AlertTriangle, ArrowRight, Loader2, MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function AgendarPage() {
  return (
    <Suspense>
      <RequiereModulo modulo="agenda">
        <Agendar />
      </RequiereModulo>
    </Suspense>
  );
}

/**
 * Reserva en pasos. Con varias sucursales se parte eligiendo una (paso 0),
 * salvo que venga en la URL (?sucursal=<slug>, p. ej. desde su página).
 * Los barberos, servicios y horarios mostrados son solo los de esa sucursal.
 */
function Agendar() {
  const barberia = useBarberia();
  const idBarberia = barberia.id_barberia;
  const router = useRouter();
  const href = useBarberiaHref();
  // En el primer paso no hay paso anterior: se vuelve al inicio de la barbería
  const volverAlInicio = () => router.push(href("/"));
  const sucursalParam = useSearchParams().get("sucursal");
  const [step, setStep] = useState(1);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState<Sucursal | null>(null);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [barbers, setBarbers] = useState<Barbero[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barbero | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [proximaFecha, setProximaFecha] = useState<Date | null | "buscando">(null);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const ultimaConsulta = useRef("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    aceptaPrivacidad: false
  });
  // HU-02: con sesión se reserva a nombre de la cuenta, salvo que se elija usar otros datos
  const [cuenta, setCuenta] = useState<{ firstName: string; lastName: string; email: string; phone: string } | null>(null);
  const [usarCuenta, setUsarCuenta] = useState(true);
  const conCuenta = cuenta !== null && usarCuenta;

  // Sucursales activas; se preselecciona la del link o la única que haya
  useEffect(() => {
    async function fetchSucursales() {
      try {
        setLoading(true);
        setError(null);
        const data = await getSucursales(createClient(), idBarberia);
        setSucursales(data);
        const inicial = data.find((s) => s.slug === sucursalParam) ?? (data.length === 1 ? data[0] : null);
        setSelectedSucursal(inicial);
        setStep(inicial ? 1 : 0);
      } catch (error) {
        console.error("Error loading sucursales:", error);
        setError("No se pudieron cargar las sucursales. Por favor, intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }
    fetchSucursales();
  }, [idBarberia, sucursalParam]);

  // Cliente con sesión: sus datos de contacto se completan solos (los puede editar)
  useEffect(() => {
    async function prellenar() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("usuario")
        .select("nombre, apellido, email, telefono")
        .eq("id_usuario", user.id)
        .maybeSingle();
      if (!data) return;
      setCuenta({
        firstName: data.nombre || "",
        lastName: data.apellido || "",
        email: data.email || user.email || "",
        phone: data.telefono || "",
      });
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || data.nombre || "",
        lastName: prev.lastName || data.apellido || "",
        email: prev.email || data.email || user.email || "",
        phone: prev.phone || data.telefono || "",
      }));
    }
    prellenar();
  }, []);

  // Barberos asignados a la sucursal elegida
  useEffect(() => {
    async function fetchBarbers() {
      if (!selectedSucursal) return;
      try {
        setLoadingBarbers(true);
        setBarbers(await getBarberos(idBarberia, selectedSucursal.id_sucursal));
      } catch (error) {
        console.error("Error loading barbers:", error);
        setError("No se pudieron cargar los barberos. Por favor, intenta de nuevo.");
      } finally {
        setLoadingBarbers(false);
      }
    }
    fetchBarbers();
  }, [idBarberia, selectedSucursal]);

  // Fetch services when barber is selected
  useEffect(() => {
    async function fetchServices() {
      if (selectedBarber) {
        try {
          setLoadingServices(true);
          const data = await getServicesByBarber(idBarberia, selectedBarber.id);
          setServices(data);
        } catch (error) {
          console.error("Error loading services:", error);
          setError("No se pudieron cargar los servicios. Por favor, intenta de nuevo.");
        } finally {
          setLoadingServices(false);
        }
      }
    }
    fetchServices();
  }, [idBarberia, selectedBarber]);

  // Fetch available time slots when date changes
  useEffect(() => {
    let vigente = true; // descarta respuestas de una fecha que ya no está elegida
    async function fetchAvailableSlots() {
      if (selectedDate && selectedBarber && selectedService && selectedSucursal) {
        // El efecto también corre al elegir la hora: el esqueleto solo se muestra al cambiar la consulta
        const consulta = `${localDateString(selectedDate)}|${selectedBarber.id}|${selectedService.id}|${selectedSucursal.id_sucursal}`;
        if (consulta !== ultimaConsulta.current) setCargandoHorarios(true);
        try {
          const slots = await getAvailableTimeSlots(idBarberia, selectedDate, selectedBarber.id, selectedService.duracion, selectedSucursal.id_sucursal);
          if (!vigente) return;
          ultimaConsulta.current = consulta;
          setAvailableTimeSlots(slots);
          // Reset selected time if it's no longer available
          if (selectedTime && !slots.some((s) => s.hora === selectedTime)) {
            setSelectedTime("");
          }
          setCargandoHorarios(false);
          // HU-02: sin horarios ese día, se busca la fecha libre más próxima
          if (slots.length > 0) return setProximaFecha(null);
          setProximaFecha("buscando");
          const proxima = await getProximaFechaDisponible(idBarberia, selectedDate, selectedBarber.id, selectedService.duracion, selectedSucursal.id_sucursal);
          if (vigente) setProximaFecha(proxima);
        } catch (error) {
          console.error("Error loading time slots:", error);
          if (!vigente) return;
          setCargandoHorarios(false);
          setAvailableTimeSlots([]);
          setProximaFecha(null);
          toast.error("No se pudieron cargar los horarios. Intenta con otra fecha.");
        }
      }
    }
    fetchAvailableSlots();
    return () => { vigente = false; };
  }, [idBarberia, selectedDate, selectedBarber, selectedService, selectedTime, selectedSucursal]);

  // Cambiar de sucursal reinicia lo elegido después (barbero, servicio, hora)
  const handleSucursalSelect = (sucursal: Sucursal) => {
    if (sucursal.id_sucursal !== selectedSucursal?.id_sucursal) {
      setSelectedBarber(null);
      setSelectedService(null);
      setSelectedDate(undefined);
      setSelectedTime("");
      setAvailableTimeSlots([]);
    }
    setSelectedSucursal(sucursal);
  };

  const handleBarberSelect = (barber: Barbero) => {
    if (barber.id !== selectedBarber?.id) {
      setSelectedService(null); // Reset service when barber changes
      setSelectedTime("");
    }
    setSelectedBarber(barber);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
  };

  const handleDateTimeSubmit = () => {
    if (selectedDate && selectedTime) {
      setStep(4);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slot = availableTimeSlots.find((s) => s.hora === selectedTime);
    if (!selectedBarber || !selectedService || !selectedDate || !slot) return;

    setSubmitting(true);

    try {
      const result = await crearReserva({
        slug: barberia.slug,
        barberoId: selectedBarber.id,
        serviceId: selectedService.id,
        idSucursal: slot.idSucursal,
        fecha: localDateString(selectedDate),
        hora: slot.hora,
        customerInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        aceptaPrivacidad: formData.aceptaPrivacidad,
        conCuenta,
      });

      if (result.success) {
        setStep(5);
      } else if (result.error === 'CLIENT_BLOCKED') {
        setBlockedModalOpen(true);
      } else if (result.horarioTomado) {
        // Otro cliente tomó la hora: vuelve a elegir con la disponibilidad recargada (el efecto depende de selectedTime)
        toast.error(result.error);
        setSelectedTime("");
        setStep(3);
      } else {
        toast.error(result.error || "Error al crear la reserva");
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast.error("Error inesperado al crear la reserva");
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setStep(sucursales.length > 1 && !sucursalParam ? 0 : 1);
    setSelectedBarber(null);
    setSelectedService(null);
    setSelectedDate(undefined);
    setSelectedTime("");
    setAvailableTimeSlots([]);
    // Los datos de contacto se conservan para la siguiente reserva
    setFormData((prev) => ({ ...prev, aceptaPrivacidad: false }));
  };

  if (loading) {
    return (
      <div className="pagina-barberia min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center" role="status">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pagina-barberia min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md" role="alert">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </span>
          <h2 className="display text-2xl mb-2">No pudimos cargar la reserva</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button className="h-12 px-6" onClick={() => window.location.reload()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const enResumen = step >= 2 && step <= 4;
  const resumen = [
    selectedBarber?.nombre,
    step >= 3 ? selectedService?.nombre : null,
    step >= 4 && selectedDate && selectedTime ? `${format(selectedDate, "d MMM", { locale: es })} ${selectedTime}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="pagina-barberia min-h-dvh bg-background">
      <BarberiaNavbar ancho="max-w-2xl" />

      <main id="contenido" className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        {step <= 4 && (
          <>
            <h1 className="display mb-5 text-3xl sm:text-4xl">Agendar cita</h1>
            <ProgressSteps currentStep={step} conSucursal={sucursales.length > 1} />
          </>
        )}

        {/* Lo elegido hasta ahora */}
        {enResumen && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
            <p className="min-w-0 truncate"><span className="text-muted-foreground">{selectedSucursal && sucursales.length > 1 ? `${selectedSucursal.nombre} · ` : ""}</span><span className="font-medium">{resumen}</span></p>
            {selectedSucursal && sucursales.length > 1 && (
              <Button variant="ghost" className="-mr-2 h-11 shrink-0 gap-1 px-2" onClick={() => setStep(0)}><MapPin className="size-4" aria-hidden="true" />Cambiar</Button>
            )}
          </div>
        )}

        {/* Step Components */}
        {step === 0 && (
          sucursales.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Esta barbería aún no tiene sucursales disponibles para reservar.
            </p>
          ) : (
            <>
              <SucursalSelection sucursales={sucursales} selected={selectedSucursal} onSelect={handleSucursalSelect} />
              <AccionesPaso onBack={volverAlInicio} backLabel="Volver">
                <Button disabled={!selectedSucursal} onClick={() => setStep(1)}>Continuar<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </AccionesPaso>
            </>
          )
        )}

        {step === 1 && (
          loadingBarbers ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-muted-foreground">Cargando barberos...</p>
            </div>
          ) : (
            <>
              <BarberSelection
                barbers={barbers}
                selectedBarber={selectedBarber}
                onBarberSelect={handleBarberSelect}
              />
              <AccionesPaso
                onBack={sucursales.length > 1 ? () => setStep(0) : volverAlInicio}
                backLabel={sucursales.length > 1 ? "Atrás" : "Volver"}
              >
                <Button disabled={!selectedBarber} onClick={() => setStep(2)}>Continuar<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </AccionesPaso>
            </>
          )
        )}

        {step === 2 && selectedBarber && (
          <>
            {loadingServices ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" aria-hidden="true" />
                <p className="text-muted-foreground">Cargando servicios...</p>
              </div>
            ) : (
              <>
                <ServiceSelection
                  services={services}
                  selectedService={selectedService}
                  onServiceSelect={handleServiceSelect}
                />
                <AccionesPaso onBack={() => setStep(1)}>
                  <Button disabled={!selectedService} onClick={() => setStep(3)}>Continuar<ArrowRight className="size-4" aria-hidden="true" /></Button>
                </AccionesPaso>
              </>
            )}
          </>
        )}

        {step === 3 && selectedBarber && selectedService && (
          <DateTimeSelection
            selectedService={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={availableTimeSlots.map((s) => s.hora)}
            proximaFecha={proximaFecha}
            cargandoHorarios={cargandoHorarios}
            onDateSelect={setSelectedDate}
            onTimeSelect={setSelectedTime}
            onBack={() => setStep(2)}
            onContinue={handleDateTimeSubmit}
          />
        )}

        {step === 4 && selectedBarber && selectedService && (
          <ContactForm
            formData={formData}
            onFormChange={setFormData}
            cuenta={cuenta}
            usarCuenta={usarCuenta}
            onUsarCuentaChange={setUsarCuenta}
            onBack={() => setStep(3)}
            onSubmit={handleFormSubmit}
          />
        )}

        {step === 5 && selectedBarber && selectedService && selectedDate && (
          <BookingConfirmation
            selectedBarber={selectedBarber}
            selectedService={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            formData={conCuenta ? { ...formData, ...cuenta } : formData}
            sucursal={selectedSucursal}
            onNewBooking={resetBooking}
          />
        )}
      </main>

      {/* Blocked client modal */}
      <BlockedClientModal
        open={blockedModalOpen}
        onOpenChange={setBlockedModalOpen}
        barberNombre={barberia.nombre}
        barberCorreo={barberia.email_contacto}
        barberTelefono={barberia.telefono}
      />

      {/* Submitting Overlay */}
      {submitting && (
        <div role="status" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground p-8 rounded-xl shadow-xl text-center">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" aria-hidden="true" />
            <p className="font-semibold">Creando tu reserva...</p>
          </div>
        </div>
      )}
    </div>
  );
}
