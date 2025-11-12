"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { BarberSelection } from "@/components/booking/barber-selection";
import { ServiceSelection } from "@/components/booking/service-selection";
import { DateTimeSelection } from "@/components/booking/date-time-selection";
import { ContactForm } from "@/components/booking/contact-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { ProgressSteps } from "@/components/booking/progress-steps";
import { getBarberos, Barbero } from "@/lib/services/barber-service";
import { getServicesByBarber, Service } from "@/lib/services/service-service";
import { createBooking, getAvailableTimeSlots } from "@/lib/services/booking-service";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function AgendarPage() {
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<Barbero[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barbero | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  // Fetch barbers on component mount
  useEffect(() => {
    async function fetchBarbers() {
      try {
        setLoading(true);
        setError(null);
        console.log("Starting to fetch barbers...");
        const data = await getBarberos();
        console.log("Fetched barbers:", data);
        setBarbers(data);
      } catch (error) {
        console.error("Error loading barbers:", error);
        setError("No se pudieron cargar los barberos. Por favor, intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }
    fetchBarbers();
  }, []);

  // Fetch services when barber is selected
  useEffect(() => {
    async function fetchServices() {
      if (selectedBarber) {
        try {
          setLoadingServices(true);
          console.log("Fetching services for barber:", selectedBarber.id);
          const data = await getServicesByBarber(selectedBarber.id);
          console.log("Fetched services:", data);
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
  }, [selectedBarber]);

  // Fetch available time slots when date changes
  useEffect(() => {
    async function fetchAvailableSlots() {
      if (selectedDate) {
        const slots = await getAvailableTimeSlots(selectedDate);
        setAvailableTimeSlots(slots);
        // Reset selected time if it's no longer available
        if (selectedTime && !slots.includes(selectedTime)) {
          setSelectedTime("");
        }
      }
    }
    fetchAvailableSlots();
  }, [selectedDate]);

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
    
    if (!selectedBarber || !selectedService || !selectedDate || !selectedTime) return;

    setSubmitting(true);

    try {
      const result = await createBooking({
        barberoId: selectedBarber.id,
        serviceId: selectedService.id,
        date: selectedDate,
        time: selectedTime,
        customerInfo: formData
      });

      if (result.success) {
        setStep(5);
      } else {
        alert(result.error || "Error al crear la reserva");
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Error inesperado al crear la reserva");
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setStep(1);
    setSelectedBarber(null);
    setSelectedService(null);
    setSelectedDate(undefined);
    setSelectedTime("");
    setAvailableTimeSlots([]);
    setFormData({ firstName: "", lastName: "", email: "", phone: "" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400">Cargando barberos...</p>
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
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver al inicio</span>
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
        <ProgressSteps currentStep={step} />

        {/* Step Components */}
        {step === 1 && (
          <BarberSelection
            barbers={barbers}
            selectedBarber={selectedBarber}
            onBarberSelect={handleBarberSelect}
          />
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
            timeSlots={availableTimeSlots.length > 0 ? availableTimeSlots : []}
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
            formData={formData}
            onNewBooking={resetBooking}
          />
        )}
      </div>

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
