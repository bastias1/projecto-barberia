"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ServiceSelection } from "@/components/booking/service-selection";
import { DateTimeSelection } from "@/components/booking/date-time-selection";
import { ContactForm } from "@/components/booking/contact-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { ProgressSteps } from "@/components/booking/progress-steps";
import { Service } from "@/lib/booking-data";
import { getServices } from "@/lib/services/service-service";
import { createBooking, getAvailableTimeSlots } from "@/lib/services/booking-service";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function AgendarPage() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  // Fetch services on component mount
  useEffect(() => {
    async function fetchServices() {
      try {
        const data = await getServices();
        setServices(data);
      } catch (error) {
        console.error("Error loading services:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, []);

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

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep(2);
  };

  const handleDateTimeSubmit = () => {
    if (selectedDate && selectedTime) {
      setStep(3);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService || !selectedDate || !selectedTime) return;

    setSubmitting(true);

    try {
      const result = await createBooking({
        serviceId: selectedService.id,
        date: selectedDate,
        time: selectedTime,
        customerInfo: formData
      });

      if (result.success) {
        setStep(4);
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
          <p className="text-zinc-600 dark:text-zinc-400">Cargando servicios...</p>
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
            Reserva tu cita en 3 simples pasos
          </p>
        </div>

        {/* Progress Steps */}
        <ProgressSteps currentStep={step} />

        {/* Step Components */}
        {step === 1 && (
          <ServiceSelection
            services={services}
            selectedService={selectedService}
            onServiceSelect={handleServiceSelect}
          />
        )}

        {step === 2 && selectedService && (
          <DateTimeSelection
            selectedService={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={availableTimeSlots.length > 0 ? availableTimeSlots : []}
            onDateSelect={setSelectedDate}
            onTimeSelect={setSelectedTime}
            onBack={() => setStep(1)}
            onContinue={handleDateTimeSubmit}
          />
        )}

        {step === 3 && (
          <ContactForm
            formData={formData}
            onFormChange={setFormData}
            onBack={() => setStep(2)}
            onSubmit={handleFormSubmit}
          />
        )}

        {step === 4 && selectedService && selectedDate && (
          <BookingConfirmation
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
