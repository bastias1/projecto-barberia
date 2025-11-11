"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ServiceSelection } from "@/components/booking/service-selection";
import { DateTimeSelection } from "@/components/booking/date-time-selection";
import { ContactForm } from "@/components/booking/contact-form";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { ProgressSteps } from "@/components/booking/progress-steps";
import { SERVICES, TIME_SLOTS, Service } from "@/lib/booking-data";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AgendarPage() {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep(2);
  };

  const handleDateTimeSubmit = () => {
    if (selectedDate && selectedTime) {
      setStep(3);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(4);
    // Here you would normally send the booking to your backend
    console.log({
      service: selectedService,
      date: selectedDate,
      time: selectedTime,
      ...formData
    });
  };

  const resetBooking = () => {
    setStep(1);
    setSelectedService(null);
    setSelectedDate(undefined);
    setSelectedTime("");
    setFormData({ firstName: "", lastName: "", email: "", phone: "" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-8">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      {/* Back Button */}
      <div className="max-w-4xl mx-auto mb-6">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Agendar Cita
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Reserva tu cita en 3 simples pasos
          </p>
        </div>

        {/* Progress Steps */}
        <ProgressSteps currentStep={step} />

        {/* Step Components */}
        {step === 1 && (
          <ServiceSelection
            services={SERVICES}
            selectedService={selectedService}
            onServiceSelect={handleServiceSelect}
          />
        )}

        {step === 2 && selectedService && (
          <DateTimeSelection
            selectedService={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            timeSlots={TIME_SLOTS}
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
    </div>
  );
}
