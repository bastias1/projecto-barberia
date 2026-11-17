"use client"

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { BarberSelection } from "@/components/booking/barber-selection";
import { ServiceSelection } from "@/components/booking/service-selection";
import { DateTimeSelection } from "@/components/booking/date-time-selection";
import { ContactForm } from "@/components/booking/contact-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { ProgressSteps } from "@/components/booking/progress-steps";
import { SucursalSelection } from "@/components/booking/sucursal-selection";
import { getBarberos, Barbero } from "@/lib/services/barber-service";
import { getServicesByBarber, Service } from "@/lib/services/service-service";
import { getAvailableTimeSlots, TimeSlot } from "@/lib/services/booking-service";
import { crearReserva } from "./actions";
import { localDateString } from "@/lib/datetime";
import { getSucursales, type Sucursal } from "@/lib/barberia";
import { createClient } from "@/utils/supabase/client";
import { useBarberia } from "@/components/barberia-provider";
import { BlockedClientModal } from "@/components/booking/blocked-client-modal";
import { RequiereModulo } from "@/components/requiere-modulo";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
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
    async function fetchAvailableSlots() {
      if (selectedDate && selectedBarber && selectedService && selectedSucursal) {
        const slots = await getAvailableTimeSlots(idBarberia, selectedDate, selectedBarber.id, selectedService.duracion, selectedSucursal.id_sucursal);
        setAvailableTimeSlots(slots);
        // Reset selected time if it's no longer available
        if (selectedTime && !slots.some((s) => s.hora === selectedTime)) {
          setSelectedTime("");
        }
      }
    }
    fetchAvailableSlots();
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
    setStep(1);
  };

  const handleBarberSelect = (barber: Barbero) => {
    setSelectedBarber(barber);
    setSelectedService(null); // Reset service when barber changes
    setStep(2);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep(3);
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Error</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-8">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      {/* Back Button */}
      <div className="max-w-4xl mx-auto mb-4 md:mb-6">
        <Link href={`/${barberia.slug}`}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver a {barberia.nombre}</span>
            <span className="sm:hidden">Volver</span>
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Agendar Cita
          </h1>
          <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 px-4">
            Reserva tu cita en 4 simples pasos
          </p>
        </div>

        {/* Progress Steps */}
        <ProgressSteps currentStep={step} conSucursal={sucursales.length > 1} />

        {/* Sucursal elegida (se puede cambiar mientras no se confirme la reserva) */}
        {selectedSucursal && sucursales.length > 1 && step >= 1 && step <= 4 && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-3 rounded-lg border bg-white/60 dark:bg-zinc-900/60">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-zinc-500" />
              <span className="font-medium">{selectedSucursal.nombre}</span>
              <span className="text-zinc-500 hidden sm:inline">· {selectedSucursal.direccion}, {selectedSucursal.comuna}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}>Cambiar sucursal</Button>
          </div>
        )}

        {/* Step Components */}
        {step === 0 && (
          sucursales.length === 0 ? (
            <p className="text-center text-zinc-600 dark:text-zinc-400 py-12">
              Esta barbería aún no tiene sucursales disponibles para reservar.
            </p>
          ) : (
            <SucursalSelection sucursales={sucursales} selected={selectedSucursal} onSelect={handleSucursalSelect} />
          )
        )}

        {step === 1 && (
          loadingBarbers ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Cargando barberos...</p>
            </div>
          ) : (
            <BarberSelection
              barbers={barbers}
              selectedBarber={selectedBarber}
              onBarberSelect={handleBarberSelect}
            />
          )
        )}

        {step === 2 && selectedBarber && (
          <>
            {loadingServices ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Cargando servicios...</p>
              </div>
            ) : (
              <ServiceSelection
                services={services}
                selectedService={selectedService}
                onServiceSelect={handleServiceSelect}
                onBack={() => setStep(1)}
              />
            )}
          </>
        )}

        {step === 3 && selectedBarber && selectedService && (
          <DateTimeSelection
            selectedService={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={availableTimeSlots.map((s) => s.hora)}
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
      </div>

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-xl text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-zinc-900 dark:text-zinc-100 font-semibold">Creando tu reserva...</p>
          </div>
        </div>
      )}
    </div>
  );
}
