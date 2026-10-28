"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

interface ContactFormProps {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    aceptaPrivacidad: boolean;
  };
  onFormChange: (data: any) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ContactForm({ formData, onFormChange, onBack, onSubmit }: ContactFormProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Información de Contacto</CardTitle>
          <CardDescription className="text-sm">Completa tus datos para confirmar la reserva</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm md:text-base">Nombre *</Label>
                <Input
                  id="firstName"
                  required
                  value={formData.firstName}
                  onChange={(e) => onFormChange({ ...formData, firstName: e.target.value })}
                  placeholder="Juan"
                  className="text-sm md:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm md:text-base">Apellido *</Label>
                <Input
                  id="lastName"
                  required
                  value={formData.lastName}
                  onChange={(e) => onFormChange({ ...formData, lastName: e.target.value })}
                  placeholder="Pérez"
                  className="text-sm md:text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm md:text-base">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                placeholder="juan@ejemplo.com"
                className="text-sm md:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm md:text-base">Teléfono (opcional)</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
                placeholder="+56 9 1234 5678"
                className="text-sm md:text-base"
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="aceptaPrivacidad"
                checked={formData.aceptaPrivacidad}
                onCheckedChange={(checked) => onFormChange({ ...formData, aceptaPrivacidad: checked === true })}
                className="mt-0.5"
              />
              <Label htmlFor="aceptaPrivacidad" className="text-sm font-normal leading-snug text-zinc-600 dark:text-zinc-400">
                <span>
                  Acepto los{" "}
                  <Link href="/terminos" target="_blank" className="underline underline-offset-4">términos</Link>
                  {" "}y la{" "}
                  <Link href="/privacidad" target="_blank" className="underline underline-offset-4">política de privacidad</Link>
                  , y que la barbería use mis datos de contacto para gestionar esta reserva y enviarme avisos sobre ella.
                </span>
              </Label>
            </div>

            <div className="flex gap-2 md:gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Atrás
              </Button>
              <Button type="submit" className="flex-1" disabled={!formData.aceptaPrivacidad}>
                <span className="hidden sm:inline">Confirmar Reserva</span>
                <span className="sm:hidden">Confirmar</span>
                <Check className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
