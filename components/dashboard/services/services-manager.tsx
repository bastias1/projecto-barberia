"use client";

import { useState, useEffect } from "react";
import { Service, getServices, createService, deleteService, toggleBarberService, getServicesByBarber } from "@/lib/services/service-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Loader2, Search, Scissors } from "lucide-react";
import { toast } from "sonner";
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
}

export function ServicesManager({ barberId }: ServicesManagerProps) {
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

    useEffect(() => {
        loadData();
    }, [barberId]);

    async function loadData() {
        try {
            setLoading(true);
            const [allServices, barberServices] = await Promise.all([
                getServices(),
                getServicesByBarber(barberId)
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
            await toggleBarberService(barberId, serviceId, checked);
            toast.success(checked ? "Servicio añadido a tu perfil" : "Servicio removido de tu perfil");
        } catch (error) {
            console.error("Error toggling service:", error);
            setBarberServiceIds(originalIds); // Revert
            toast.error("Error al actualizar el servicio");
        }
    }

    async function handleDeleteService(id: number) {
        if (!confirm("¿Estás seguro de que quieres eliminar este servicio permanentemente? Esto afectará a todos los barberos.")) {
            return;
        }

        try {
            await deleteService(id);
            setServices(services.filter(s => s.id !== id));
            setBarberServiceIds(barberServiceIds.filter(sid => sid !== id));
            toast.success("Servicio eliminado correctamente");
        } catch (error) {
            console.error("Error deleting service:", error);
            toast.error("Error al eliminar el servicio");
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
            const created = await createService({
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
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Mis Servicios</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{barberServiceIds.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Servicios activos en tu perfil</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Total Catálogo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{services.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Servicios disponibles globalmente</p>
                    </CardContent>
                </Card>
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
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                        <Scissors className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p>No se encontraron servicios.</p>
                                </div>
                            ) : (
                                filteredServices.map((service) => (
                                    <div key={service.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors group">
                                        <div className="col-span-2 sm:col-span-1 flex justify-center">
                                            <Checkbox
                                                checked={barberServiceIds.includes(service.id)}
                                                onCheckedChange={(checked) => handleToggleService(service.id, checked as boolean)}
                                            />
                                        </div>
                                        <div className="col-span-6 sm:col-span-5 font-medium flex items-center gap-2">
                                            {service.nombre}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 text-sm text-muted-foreground">
                                            ${service.precio.toLocaleString()}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 text-sm text-muted-foreground">
                                            <Badge variant="secondary" className="font-normal">
                                                {service.duracion} min
                                            </Badge>
                                        </div>
                                        <div className="col-span-12 sm:col-span-2 flex justify-end sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                onClick={() => handleDeleteService(service.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
