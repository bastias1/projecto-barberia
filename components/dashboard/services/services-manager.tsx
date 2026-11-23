"use client";

import { useState, useEffect } from "react";
import { Service, getServices, createService, deleteService, toggleBarberService, getServicesByBarber, archiveService, restoreService } from "@/lib/services/service-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Search, Scissors } from "lucide-react";
import { AccionesCatalogo, NoSePuedeEliminarDialog, SinResultados, StatCard } from "@/components/dashboard/catalogo-comun";
import { toast } from "sonner";
import { useBarberia } from "@/components/barberia-provider";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DashboardTableSkeleton } from "@/components/dashboard/loading-skeletons";

interface ServicesManagerProps {
    barberId: string;
    /** Crear, archivar y eliminar servicios del catálogo (solo admin, por RLS) */
    canManageCatalog: boolean;
    /** Tiene agenda propia: puede marcar los servicios que ofrece */
    isProfesional: boolean;
}

export function ServicesManager({ barberId, canManageCatalog, isProfesional }: ServicesManagerProps) {
    const { id_barberia: idBarberia } = useBarberia();
    const [services, setServices] = useState<Service[]>([]);
    const [barberServiceIds, setBarberServiceIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // New service form state
    const [isAdding, setIsAdding] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newService, setNewService] = useState({
        nombre: "",
        precio: "",
        duracion: ""
    });

    // Servicio que la BD no dejó eliminar (tiene reservas): se ofrece archivarlo
    const [noEliminable, setNoEliminable] = useState<Service | null>(null);

    useEffect(() => {
        loadData();
    }, [barberId]);

    async function loadData() {
        try {
            setLoading(true);
            const [allServices, barberServices] = await Promise.all([
                getServices(idBarberia),
                getServicesByBarber(idBarberia, barberId)
            ]);

            setServices(allServices);
            setBarberServiceIds(barberServices.map(s => s.id));
        } catch (error) {
            console.error("Error loading services:", error);
            toast.error("Error al cargar los servicios");
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleService(serviceId: number, checked: boolean) {
        // Optimistic update
        const originalIds = [...barberServiceIds];
        if (checked) {
            setBarberServiceIds([...barberServiceIds, serviceId]);
        } else {
            setBarberServiceIds(barberServiceIds.filter(id => id !== serviceId));
        }

        try {
            await toggleBarberService(idBarberia, barberId, serviceId, checked);
            toast.success(checked ? "Servicio añadido a tu perfil" : "Servicio removido de tu perfil");
        } catch (error) {
            console.error("Error toggling service:", error);
            setBarberServiceIds(originalIds); // Revert
            toast.error("Error al actualizar el servicio");
        }
    }

    async function handleDeleteService(id: number) {
        const service = services.find(s => s.id === id);
        try {
            await deleteService(id);
            setServices(services.filter(s => s.id !== id));
            setBarberServiceIds(barberServiceIds.filter(sid => sid !== id));
            toast.success("Servicio eliminado correctamente");
        } catch (error) {
            console.error("Error deleting service:", error);
            const errorMessage = error instanceof Error ? error.message : "Error al eliminar el servicio";
            
            // Check if it's a foreign key constraint error
            if (errorMessage.includes("reservas") || errorMessage.includes("asociadas")) {
                if (service) setNoEliminable(service);
            } else {
                toast.error(errorMessage);
            }
        }
    }

    async function handleArchiveService(id: number) {
        try {
            const archived = await archiveService(id);
            if (archived) {
                setServices(services.map(s => s.id === id ? { ...s, activo: false } : s));
                toast.success("Servicio archivado - Ya no aparecerá en las reservas");
            }
        } catch (error) {
            console.error("Error archiving service:", error);
            toast.error("Error al archivar el servicio");
        }
    }

    async function handleRestoreService(id: number) {
        try {
            const restored = await restoreService(id);
            if (restored) {
                setServices(services.map(s => s.id === id ? { ...s, activo: true } : s));
                toast.success("Servicio restaurado - Ahora aparecerá en las reservas");
            }
        } catch (error) {
            console.error("Error restoring service:", error);
            toast.error("Error al restaurar el servicio");
        }
    }

    async function handleArchiveFromDialog() {
        if (noEliminable) {
            await handleArchiveService(noEliminable.id);
            setNoEliminable(null);
        }
    }

    async function handleCreateService(e: React.FormEvent) {
        e.preventDefault();
        if (!newService.nombre || !newService.precio || !newService.duracion) {
            toast.error("Por favor completa todos los campos");
            return;
        }

        try {
            setIsAdding(true);
            const created = await createService(idBarberia, {
                nombre: newService.nombre,
                precio: Number(newService.precio),
                duracion: Number(newService.duracion)
            });

            if (created) {
                setServices([...services, created]);
                setNewService({ nombre: "", precio: "", duracion: "" });
                setIsDialogOpen(false);
                toast.success("Servicio creado exitosamente");
            }
        } catch (error) {
            console.error("Error creating service:", error);
            toast.error("Error al crear el servicio");
        } finally {
            setIsAdding(false);
        }
    }

    const filteredServices = services.filter(service =>
        service.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return <DashboardTableSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <StatCard titulo="Mis Servicios" valor={barberServiceIds.length} nota="Servicios activos en tu perfil" />
                <StatCard titulo="Total Catálogo" valor={services.length} nota="Servicios en el catálogo" />
                <StatCard titulo="Activos" valor={services.filter(s => s.activo !== false).length} nota="Disponibles para reservar" className="text-green-600" />
                <StatCard titulo="Archivados" valor={services.filter(s => s.activo === false).length} nota="Ocultos de reservas" className="text-orange-600" />
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar servicio..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {canManageCatalog && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Servicio
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Servicio</DialogTitle>
                            <DialogDescription>
                                Agrega un nuevo servicio al catálogo global de la barbería.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateService} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del servicio</Label>
                                <Input
                                    id="name"
                                    placeholder="Ej. Corte Clásico"
                                    value={newService.nombre}
                                    onChange={(e) => setNewService({ ...newService, nombre: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="price">Precio ($)</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        placeholder="0"
                                        value={newService.precio}
                                        onChange={(e) => setNewService({ ...newService, precio: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="duration">Duración (min)</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        placeholder="30"
                                        value={newService.duracion}
                                        onChange={(e) => setNewService({ ...newService, duracion: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isAdding} className="w-full">
                                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Guardar Servicio
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                )}
            </div>

            {/* Services List */}
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm text-muted-foreground">
                            <div className="col-span-2 sm:col-span-1 text-center">Oferta</div>
                            <div className="col-span-6 sm:col-span-5">Nombre</div>
                            <div className="col-span-2 sm:col-span-2">Precio</div>
                            <div className="col-span-2 sm:col-span-2">Duración</div>
                            <div className="hidden sm:block sm:col-span-2 text-right">Acciones</div>
                        </div>
                        <div className="divide-y">
                            {filteredServices.length === 0 ? (
                                <SinResultados icono={Scissors} texto="No se encontraron servicios." />
                            ) : (
                                filteredServices.map((service) => (
                                    <div key={service.id} className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors group ${service.activo === false ? 'opacity-60 bg-muted/30' : ''}`}>
                                        <div className="col-span-2 sm:col-span-1 flex justify-center">
                                            <Checkbox
                                                checked={barberServiceIds.includes(service.id)}
                                                onCheckedChange={(checked) => handleToggleService(service.id, checked as boolean)}
                                                disabled={service.activo === false || !isProfesional}
                                            />
                                        </div>
                                        <div className="col-span-6 sm:col-span-5 font-medium flex items-center gap-2">
                                            {service.nombre}
                                            {service.activo === false && (
                                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                                    Archivado
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 text-sm text-muted-foreground">
                                            ${service.precio.toLocaleString("es-CL")}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 text-sm text-muted-foreground">
                                            <Badge variant="secondary" className="font-normal">
                                                {service.duracion} min
                                            </Badge>
                                        </div>
                                        {canManageCatalog && (
                                        <div className="col-span-12 sm:col-span-2 flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <AccionesCatalogo
                                                tipo="servicio"
                                                archivado={service.activo === false}
                                                onArchivar={() => handleArchiveService(service.id)}
                                                onRestaurar={() => handleRestoreService(service.id)}
                                                onEliminar={() => handleDeleteService(service.id)}
                                                confirmacion={<>
                                                    <span className="block">Esta acción eliminará permanentemente el servicio <b>{service.nombre}</b>.</span>
                                                    <span className="block mt-2"><strong>Nota:</strong> Si el servicio tiene reservas asociadas, no podrá ser eliminado. Usa &quot;Archivar&quot; en su lugar.</span>
                                                </>}
                                            />
                                        </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <NoSePuedeEliminarDialog
                tipo="servicio"
                nombre={noEliminable?.nombre}
                motivo="reservas"
                historial="historial de reservas"
                dondeSale="la página de reservas"
                mantiene="Mantendrá el historial de citas"
                onArchivar={handleArchiveFromDialog}
                onCerrar={() => setNoEliminable(null)}
            />
        </div>
    );
}
