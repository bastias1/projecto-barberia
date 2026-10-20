"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Clock, MapPin } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import type { DaySchedule, HorarioBarbero } from "@/lib/services/schedule-service";
import type { Sucursal } from "@/lib/barberia";
import { toast } from "sonner";

interface WeeklyScheduleProps {
  barberId: string;
  barberiaId: string;
  sucursales: Sucursal[];
  initialSchedules: DaySchedule[];
}

const HORARIO_COLUMNS = 'id:id_horario, id_sucursal, dia_semana, hora_inicio, hora_fin, activo';

function scheduleErrorMessage(error: { code?: string; message?: string }, fallback: string) {
  // horario_atencion_sin_solape: un barbero no puede tener tramos superpuestos el mismo día
  if (error?.code === '23P01') return 'Se superpone con otro horario activo de ese día';
  // a_horario_sucursal_asignada: solo en sucursales asignadas por el administrador
  if (error?.code === '23514' && error.message) return error.message;
  return fallback;
}

const DAYS = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miércoles", short: "Mié" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
];

// Generate hours from 6 AM to 10 PM in 1-hour segments
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const hour = (i + 6).toString().padStart(2, '0');
  return `${hour}:00`;
});

const PRESET_RANGES = [
  { label: "Mañana", start: "09:00", end: "13:00", icon: "🌅" },
  { label: "Tarde", start: "14:00", end: "18:00", icon: "☀️" },
  { label: "Completo", start: "09:00", end: "18:00", icon: "⏰" },
  { label: "Noche", start: "18:00", end: "22:00", icon: "🌙" },
];

export function WeeklySchedule({ barberId, barberiaId, sucursales, initialSchedules }: WeeklyScheduleProps) {
  const [schedules, setSchedules] = useState<DaySchedule[]>(initialSchedules);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [sucursalId, setSucursalId] = useState<number | null>(sucursales[0]?.id_sucursal ?? null);
  const sucursalNombre = (id: number) => sucursales.find(s => s.id_sucursal === id)?.nombre ?? '';
  const [newSchedule, setNewSchedule] = useState({
    hora_inicio: "09:00",
    hora_fin: "18:00",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleAddSchedule = async (range: { hora_inicio: string; hora_fin: string } = newSchedule) => {
    if (selectedDay === null) return;
    if (sucursalId === null) {
      toast.error('No hay sucursales activas para asignar el horario');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('horario_atencion')
        .insert({
          id_barberia: barberiaId,
          id_profesional: barberId,
          id_sucursal: sucursalId,
          dia_semana: selectedDay,
          hora_inicio: range.hora_inicio,
          hora_fin: range.hora_fin,
          activo: true,
        })
        .select(HORARIO_COLUMNS)
        .single<HorarioBarbero>();

      if (error) throw error;

      // Optimistically update local state
      if (data) {
        setSchedules(prevSchedules => {
          const existingDayIndex = prevSchedules.findIndex(s => s.dia_semana === selectedDay);
          
          if (existingDayIndex >= 0) {
            // Day exists, add schedule to it
            const updated = [...prevSchedules];
            updated[existingDayIndex] = {
              ...updated[existingDayIndex],
              horarios: [...updated[existingDayIndex].horarios, data]
            };
            return updated;
          } else {
            // Day doesn't exist, create new entry
            return [...prevSchedules, { dia_semana: selectedDay, horarios: [data] }];
          }
        });
      }

      setDialogOpen(false);
      setNewSchedule({ hora_inicio: "09:00", hora_fin: "18:00" });
      toast.success('Horario agregado correctamente');
      router.refresh();
    } catch (error) {
      console.error('Error adding schedule:', error);
      toast.error(scheduleErrorMessage(error as { code?: string }, 'Error al agregar horario'));
    }
  };

  const handleToggleSchedule = async (scheduleId: number, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('horario_atencion')
        .update({ activo: !currentActive })
        .eq('id_horario', scheduleId);

      if (error) throw error;

      // Optimistically update local state
      setSchedules(prevSchedules => 
        prevSchedules.map(daySchedule => ({
          ...daySchedule,
          horarios: daySchedule.horarios.map(schedule => 
            schedule.id === scheduleId 
              ? { ...schedule, activo: !currentActive }
              : schedule
          )
        }))
      );

      router.refresh();
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast.error(scheduleErrorMessage(error as { code?: string }, 'Error al actualizar horario'));
      // Revert on error
      router.refresh();
    }
  };

  const handleDeleteSchedule = async () => {
    if (scheduleToDelete === null) return;

    try {
      const { error } = await supabase
        .from('horario_atencion')
        .delete()
        .eq('id_horario', scheduleToDelete);

      if (error) throw error;

      // Optimistically update local state
      setSchedules(prevSchedules => 
        prevSchedules.map(daySchedule => ({
          ...daySchedule,
          horarios: daySchedule.horarios.filter(schedule => schedule.id !== scheduleToDelete)
        })).filter(daySchedule => daySchedule.horarios.length > 0)
      );

      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
      toast.success('Horario eliminado correctamente');
      router.refresh();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Error al eliminar horario');
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
      router.refresh();
    }
  };

  const getDaySchedules = (dayValue: number) => {
    return schedules.find(s => s.dia_semana === dayValue)?.horarios || [];
  };

  return (
    <Card className="md:shadow-md border-0 md:border">
      <CardHeader className="pb-3 md:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardDescription className="text-xs md:text-sm">
            Configura los días y horarios en los que estás disponible para atender
          </CardDescription>
          {sucursales.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Nuevos horarios en</Label>
              <Select value={sucursalId?.toString()} onValueChange={(v) => setSucursalId(Number(v))}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id_sucursal} value={s.id_sucursal.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {DAYS.map(day => {
            const daySchedules = getDaySchedules(day.value);
            const hasSchedules = daySchedules.length > 0;
            const hasActiveSchedules = daySchedules.some(s => s.activo);

            return (
              <div
                key={day.value}
                className={`border-2 rounded-lg p-3 md:p-4 transition-all ${
                  hasActiveSchedules
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : hasSchedules
                    ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50'
                    : 'border-dashed border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <h3 className="font-semibold text-sm md:text-base text-zinc-900 dark:text-zinc-100">
                    {day.label}
                  </h3>
                  {isMobile ? (
                    <Drawer open={dialogOpen && selectedDay === day.value} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) setSelectedDay(day.value);
                    }}>
                      <DrawerTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedDay(day.value)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="max-h-[90vh]">
                        <DrawerHeader>
                          <DrawerTitle>Agregar Horario - {day.label}</DrawerTitle>
                          <DrawerDescription>
                            Selecciona un rango de horario o usa un preset común
                          </DrawerDescription>
                        </DrawerHeader>
                        <Tabs defaultValue="presets" className="w-full">
                          <div className="px-4">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="presets">Rangos Comunes</TabsTrigger>
                              <TabsTrigger value="custom">Personalizado</TabsTrigger>
                            </TabsList>
                          </div>
                          <TabsContent value="presets" className="px-4 pb-4 space-y-6">
                            {/* Preset Buttons */}
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                {PRESET_RANGES.map((preset) => (
                                  <Button
                                    key={preset.label}
                                    variant="outline"
                                    className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-500"
                                    onClick={() => setNewSchedule({ hora_inicio: preset.start, hora_fin: preset.end })}
                                  >
                                    <span className="text-2xl">{preset.icon}</span>
                                    <span className="font-semibold text-xs">{preset.label}</span>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {preset.start.slice(0, 5)} - {preset.end.slice(0, 5)}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Selected Range Display */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">Horario Seleccionado</Label>
                              <div className="flex items-center justify-center gap-3">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {newSchedule.hora_inicio.slice(0, 5)}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Inicio</div>
                                </div>
                                <div className="text-zinc-400 dark:text-zinc-600 text-xl">→</div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {newSchedule.hora_fin.slice(0, 5)}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Fin</div>
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                          <TabsContent value="custom" className="px-4 pb-4 space-y-6">
                            {/* Selected Range Display */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">Horario Seleccionado</Label>
                              <div className="flex items-center justify-center gap-3">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {newSchedule.hora_inicio.slice(0, 5)}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Inicio</div>
                                </div>
                                <div className="text-zinc-400 dark:text-zinc-600 text-xl">→</div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {newSchedule.hora_fin.slice(0, 5)}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Fin</div>
                                </div>
                              </div>
                            </div>

                            {/* Hour Selection - Start */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Hora de Inicio</Label>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {HOURS.map((hour) => (
                              <Button
                                key={`start-${hour}`}
                                variant={newSchedule.hora_inicio === hour ? "default" : "outline"}
                                size="sm"
                                className={`h-11 font-medium transition-all ${
                                  newSchedule.hora_inicio === hour 
                                    ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md scale-105" 
                                    : "hover:border-blue-300 dark:hover:border-blue-700"
                                }`}
                                onClick={() => setNewSchedule({ ...newSchedule, hora_inicio: hour })}
                              >
                                {hour.slice(0, 5)}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Hour Selection - End */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Hora de Fin</Label>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {HOURS.map((hour) => {
                              const isBeforeStart = hour <= newSchedule.hora_inicio;
                              return (
                                <Button
                                  key={`end-${hour}`}
                                  variant={newSchedule.hora_fin === hour ? "default" : "outline"}
                                  size="sm"
                                  disabled={isBeforeStart}
                                  className={`h-11 font-medium transition-all ${
                                    newSchedule.hora_fin === hour 
                                      ? "bg-purple-500 hover:bg-purple-600 text-white shadow-md scale-105" 
                                      : isBeforeStart
                                      ? "opacity-30 cursor-not-allowed"
                                      : "hover:border-purple-300 dark:hover:border-purple-700"
                                  }`}
                                  onClick={() => setNewSchedule({ ...newSchedule, hora_fin: hour })}
                                >
                                  {hour.slice(0, 5)}
                                </Button>
                              );
                            })}
                          </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                        <DrawerFooter className="border-t bg-zinc-50 dark:bg-zinc-900/50">
                          <Button
                            onClick={() => handleAddSchedule()}
                            className="w-full h-12 text-base font-semibold"
                            disabled={newSchedule.hora_inicio >= newSchedule.hora_fin}
                          >
                            Agregar Horario
                          </Button>
                          <DrawerClose asChild>
                            <Button variant="outline" className="w-full">
                              Cancelar
                            </Button>
                          </DrawerClose>
                        </DrawerFooter>
                      </DrawerContent>
                    </Drawer>
                  ) : (
                    <Dialog open={dialogOpen && selectedDay === day.value} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) setSelectedDay(day.value);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedDay(day.value)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Agregar Horario - {day.label}</DialogTitle>
                          <DialogDescription>
                            Selecciona un rango de horario o usa un preset común
                          </DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="presets" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="presets">Rangos Comunes</TabsTrigger>
                            <TabsTrigger value="custom">Personalizado</TabsTrigger>
                          </TabsList>
                          <TabsContent value="presets" className="space-y-4 pt-4">
                            <div className="grid grid-cols-4 gap-3">
                              {PRESET_RANGES.map((preset) => (
                                <Button
                                  key={preset.label}
                                  variant="outline"
                                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-500"
                                  onClick={() => {
                                    const range = { hora_inicio: preset.start, hora_fin: preset.end };
                                    setNewSchedule(range);
                                    handleAddSchedule(range);
                                  }}
                                >
                                  <span className="text-3xl">{preset.icon}</span>
                                  <span className="font-semibold text-sm">{preset.label}</span>
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {preset.start.slice(0, 5)} - {preset.end.slice(0, 5)}
                                  </span>
                                </Button>
                              ))}
                            </div>
                          </TabsContent>
                          <TabsContent value="custom" className="space-y-6 pt-4">
                            {/* Selected Range Display */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">Horario Seleccionado</Label>
                              <div className="flex items-center justify-center gap-3">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {newSchedule.hora_inicio.slice(0, 5)}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Inicio</div>
                                </div>
                                <div className="text-zinc-400 dark:text-zinc-600 text-xl">→</div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {newSchedule.hora_fin.slice(0, 5)}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Fin</div>
                                </div>
                              </div>
                            </div>

                            {/* Hour Selection - Start */}
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Hora de Inicio</Label>
                              <div className="grid grid-cols-6 gap-2">
                                {HOURS.map((hour) => (
                                  <Button
                                    key={`start-${hour}`}
                                    variant={newSchedule.hora_inicio === hour ? "default" : "outline"}
                                    size="sm"
                                    className={`h-11 font-medium transition-all ${
                                      newSchedule.hora_inicio === hour 
                                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md scale-105" 
                                        : "hover:border-blue-300 dark:hover:border-blue-700"
                                    }`}
                                    onClick={() => setNewSchedule({ ...newSchedule, hora_inicio: hour })}
                                  >
                                    {hour.slice(0, 5)}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Hour Selection - End */}
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Hora de Fin</Label>
                              <div className="grid grid-cols-6 gap-2">
                                {HOURS.map((hour) => {
                                  const isBeforeStart = hour <= newSchedule.hora_inicio;
                                  return (
                                    <Button
                                      key={`end-${hour}`}
                                      variant={newSchedule.hora_fin === hour ? "default" : "outline"}
                                      size="sm"
                                      disabled={isBeforeStart}
                                      className={`h-11 font-medium transition-all ${
                                        newSchedule.hora_fin === hour 
                                          ? "bg-purple-500 hover:bg-purple-600 text-white shadow-md scale-105" 
                                          : isBeforeStart
                                          ? "opacity-30 cursor-not-allowed"
                                          : "hover:border-purple-300 dark:hover:border-purple-700"
                                      }`}
                                      onClick={() => setNewSchedule({ ...newSchedule, hora_fin: hour })}
                                    >
                                      {hour.slice(0, 5)}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancelar
                              </Button>
                              <Button
                                onClick={() => handleAddSchedule()}
                                disabled={newSchedule.hora_inicio >= newSchedule.hora_fin}
                              >
                                Agregar Horario
                              </Button>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {!hasSchedules ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-4">
                    Sin horarios
                  </p>
                ) : (
                  <div className="space-y-2">
                    {daySchedules.map(schedule => (
                      <div
                        key={schedule.id}
                        className={`flex items-center justify-between p-2 rounded text-sm ${
                          schedule.activo
                            ? 'bg-white dark:bg-zinc-800'
                            : 'bg-zinc-200 dark:bg-zinc-900 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Switch
                            checked={schedule.activo}
                            onCheckedChange={() => handleToggleSchedule(schedule.id, schedule.activo)}
                          />
                          <span className={!schedule.activo ? "line-through" : ""}>
                            {schedule.hora_inicio.slice(0, 5)} - {schedule.hora_fin.slice(0, 5)}
                          </span>
                          {sucursales.length > 1 && (
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                              {sucursalNombre(schedule.id_sucursal)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          onClick={() => {
                            setScheduleToDelete(schedule.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar horario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El horario será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setScheduleToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule} className="bg-red-500 hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
