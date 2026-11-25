"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import Link from "next/link";
import { AccionesPaso } from "./acciones-paso";
import { TituloPaso } from "./opcion-card";
import { Vidrio } from "@/components/vidrio";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  aceptaPrivacidad: boolean;
}

interface ContactFormProps {
  formData: FormData;
  onFormChange: (data: FormData) => void;
  /** Datos de la cuenta con sesión (HU-02); null = sin sesión, solo invitado */
  cuenta?: { firstName: string; lastName: string; email: string; phone: string } | null;
  usarCuenta?: boolean;
  onUsarCuentaChange?: (usar: boolean) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ContactForm({ formData, onFormChange, cuenta, usarCuenta, onUsarCuentaChange, onBack, onSubmit }: ContactFormProps) {
  const conCuenta = !!cuenta && !!usarCuenta;
  return (
    <div>
      <TituloPaso
        titulo="Tus datos"
        ayuda={conCuenta ? "La reserva quedará a nombre de tu cuenta" : "Los usamos solo para confirmar tu reserva"}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        {cuenta && (
          <div className="flex flex-wrap items-center justify-between gap-2 tarjeta rounded-xl border border-border bg-card p-4 text-sm">
            <Vidrio />
            {conCuenta ? (
              <div className="min-w-0">
                <p className="font-semibold">{cuenta.firstName} {cuenta.lastName}</p>
                <p className="break-all text-muted-foreground">{cuenta.email}{cuenta.phone && ` · ${cuenta.phone}`}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Reservando con otros datos, sin usar tu cuenta.</p>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={() => onUsarCuentaChange?.(!conCuenta)}>
              {conCuenta ? "Usar otros datos" : "Usar mi cuenta"}
            </Button>
          </div>
        )}

        {!conCuenta && (<>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre *</Label>
              <Input id="firstName" required autoComplete="given-name" value={formData.firstName}
                onChange={(e) => onFormChange({ ...formData, firstName: e.target.value })} placeholder="Juan" className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido *</Label>
              <Input id="lastName" required autoComplete="family-name" value={formData.lastName}
                onChange={(e) => onFormChange({ ...formData, lastName: e.target.value })} placeholder="Pérez" className="h-12 text-base" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo *</Label>
            <Input id="email" type="email" required autoComplete="email" inputMode="email" value={formData.email}
              onChange={(e) => onFormChange({ ...formData, email: e.target.value })} placeholder="juan@ejemplo.com" className="h-12 text-base" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={formData.phone}
              onChange={(e) => onFormChange({ ...formData, phone: e.target.value })} placeholder="+56 9 1234 5678" className="h-12 text-base" />
          </div>

          <div className="flex items-start gap-3 tarjeta rounded-xl border border-border bg-card p-4">
            <Vidrio />
            <Checkbox
              id="aceptaPrivacidad"
              checked={formData.aceptaPrivacidad}
              onCheckedChange={(checked) => onFormChange({ ...formData, aceptaPrivacidad: checked === true })}
              className="mt-0.5 size-5"
            />
            <Label htmlFor="aceptaPrivacidad" className="block text-sm font-normal leading-snug text-muted-foreground">
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="underline underline-offset-4">términos</Link>
              {" "}y la{" "}
              <Link href="/privacidad" target="_blank" className="underline underline-offset-4">política de privacidad</Link>
              , y que la barbería use mis datos de contacto para gestionar esta reserva y enviarme avisos sobre ella.
            </Label>
          </div>
        </>)}

        <AccionesPaso onBack={onBack}>
          <Button type="submit" disabled={!conCuenta && !formData.aceptaPrivacidad}>
            Confirmar reserva
            <Check className="size-4" aria-hidden="true" />
          </Button>
        </AccionesPaso>
      </form>
    </div>
  );
}
