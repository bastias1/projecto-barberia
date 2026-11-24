"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BlockedDate } from "@/lib/services/schedule-service";
import { localDateString } from "@/lib/datetime";

interface BlockedDatesProps {
  barberId: string;
  barberiaId: string;
  initialBlockedDates: BlockedDate[];
}

export function BlockedDates({ barberId, barberiaId, initialBlockedDates }: BlockedDatesProps) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>(initialBlockedDates);

  // router.refresh() trae los datos nuevos por props
  useEffect(() => setBlockedDates(initialBlockedDates), [initialBlockedDates]);
  const [newBlock, setNewBlock] = useState({
    fecha: "",
    motivo: "",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleAddBlockedDate = async () => {
    if (!newBlock.fecha) {
      toast.error('Debes seleccionar una fecha');
      return;
    }

    try {
      const { error } = await supabase
        .from('dia_bloqueado')
        .insert({
          id_barberia: barberiaId,
          id_profesional: barberId,
          fecha: newBlock.fecha,
          motivo: newBlock.motivo || null,
        });

      if (error) throw error;

      setNewBlock({ fecha: "", motivo: "" });
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error adding blocked date:', error);
      if ((error as { code?: string }).code === "23505") {
        toast.error('Esta fecha ya está bloqueada');
      } else {
        toast.error('Error al bloquear fecha');
      }
    }
  };

  const handleDeleteBlockedDate = async () => {
    if (dateToDelete === null) return;

    try {
      const { error } = await supabase
        .from('dia_bloqueado')
        .delete()
        .eq('id_dia_bloqueado', dateToDelete);

      if (error) throw error;

      setDeleteDialogOpen(false);
      setDateToDelete(null);
      router.refresh();
    } catch (error) {
      console.error('Error deleting blocked date:', error);
      setDeleteDialogOpen(false);
      setDateToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="md:shadow-md border-0 md:border">
      <CardHeader className="pb-3 md:pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <CalendarX className="h-4 w-4 md:h-5 md:w-5" />
              Días Bloqueados
            </CardTitle>
            <CardDescription className="mt-1 text-xs md:text-sm">
              Marca fechas específicas como no disponibles
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0">
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Bloquear Fecha</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bloquear Fecha</DialogTitle>
                <DialogDescription>
                  Selecciona una fecha que no estará disponible para reservas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={newBlock.fecha}
                    onChange={(e) => setNewBlock({ ...newBlock, fecha: e.target.value })}
                    min={localDateString(new Date())}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motivo (opcional)</Label>
                  <Input
                    type="text"
                    placeholder="Ej: Vacaciones, Feriado..."
                    value={newBlock.motivo}
                    onChange={(e) => setNewBlock({ ...newBlock, motivo: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddBlockedDate}>
                    Bloquear Fecha
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {blockedDates.length === 0 ? (
          <div className="text-center py-6 md:py-8 text-zinc-500 dark:text-zinc-400">
            <CalendarX className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
            <p className="text-xs md:text-sm">No hay fechas bloqueadas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {blockedDates.map(blocked => (
              <div
                key={blocked.id}
                className="border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 md:p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs md:text-sm">{formatDate(blocked.fecha)}</p>
                    {blocked.motivo && (
                      <p className="text-[10px] md:text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate">
                        {blocked.motivo}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 md:h-8 md:w-8 text-red-500 hover:text-red-700 shrink-0"
                    onClick={() => {
                      setDateToDelete(blocked.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desbloquear esta fecha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta fecha volverá a estar disponible para reservas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDateToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBlockedDate}>
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
