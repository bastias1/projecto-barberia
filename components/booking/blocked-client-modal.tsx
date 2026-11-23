'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ban, Mail, Phone } from "lucide-react";

interface BlockedClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barberNombre?: string;
  barberCorreo?: string | null;
  barberTelefono?: string | null;
}

export function BlockedClientModal({
  open,
  onOpenChange,
  barberNombre,
  barberCorreo,
  barberTelefono,
}: BlockedClientModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Ban className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Acceso restringido
          </DialogTitle>
          <DialogDescription className="text-center mt-2">
            No es posible realizar reservas en este momento.
            Contacta a la barbería para aclarar la situación.
          </DialogDescription>
        </DialogHeader>

        {(barberCorreo || barberTelefono) && (
          <div className="mt-2 rounded-lg border bg-muted/50 p-4 space-y-3">
            <p className="text-sm font-medium text-center text-muted-foreground">
              Información de contacto{barberNombre ? ` — ${barberNombre}` : ""}
            </p>
            {barberTelefono && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <a
                  href={`tel:${barberTelefono}`}
                  className="text-sm font-medium hover:underline"
                >
                  {barberTelefono}
                </a>
              </div>
            )}
            {barberCorreo && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <a
                  href={`mailto:${barberCorreo}`}
                  className="text-sm font-medium hover:underline truncate"
                >
                  {barberCorreo}
                </a>
              </div>
            )}
          </div>
        )}

        <Button
          className="w-full mt-2"
          onClick={() => onOpenChange(false)}
        >
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}
