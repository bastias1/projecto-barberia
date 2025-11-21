"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { REGIONS } from "@/lib/chile-data";

// Helper to get comunas for a region
const getComunas = (regionName: string) => {
    const region = REGIONS.find((r) => r.name === regionName);
    return region ? region.comunas : [];
};

export function AddressManager() {
    const [addresses, setAddresses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [newAddress, setNewAddress] = useState({
        nombre_etiqueta: "",
        region: "",
        comuna: "",
        calle: "",
        depto: "",
        telefono: "",
    });

    const supabase = createClient();

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("direccion_usuario")
                .select("*")
                .eq("usuario_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAddresses(data || []);
        } catch (error) {
            console.error("Error fetching addresses:", error);
            toast.error("Error al cargar direcciones");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from("direccion_usuario").insert({
                usuario_id: user.id,
                nombre_etiqueta: newAddress.nombre_etiqueta,
                region: newAddress.region,
                comuna: newAddress.comuna,
                ciudad: newAddress.comuna, // Usually same as comuna or derived
                calle: newAddress.calle,
                depto: newAddress.depto,
                telefono: newAddress.telefono,
            });

            if (error) throw error;

            toast.success("Dirección agregada");
            setIsDialogOpen(false);
            setNewAddress({
                nombre_etiqueta: "",
                region: "",
                comuna: "",
                calle: "",
                depto: "",
                telefono: "",
            });
            fetchAddresses();
        } catch (error) {
            console.error("Error adding address:", error);
            toast.error("Error al agregar dirección");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAddress = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta dirección?")) return;
        try {
            const { error } = await supabase
                .from("direccion_usuario")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success("Dirección eliminada");
            fetchAddresses();
        } catch (error) {
            console.error("Error deleting address:", error);
            toast.error("Error al eliminar dirección");
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Mis Direcciones</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Dirección
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Agregar Nueva Dirección</DialogTitle>
                            <DialogDescription>
                                Ingresa los detalles de tu dirección de envío.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddAddress} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="etiqueta">Nombre (Ej: Casa, Trabajo)</Label>
                                <Input
                                    id="etiqueta"
                                    value={newAddress.nombre_etiqueta}
                                    onChange={(e) => setNewAddress({ ...newAddress, nombre_etiqueta: e.target.value })}
                                    placeholder="Casa"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Región</Label>
                                    <Select
                                        value={newAddress.region}
                                        onValueChange={(val) => setNewAddress({ ...newAddress, region: val, comuna: "" })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una región" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {REGIONS.map((region) => (
                                                <SelectItem key={region.name} value={region.name}>
                                                    {region.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Comuna</Label>
                                    <Select
                                        value={newAddress.comuna}
                                        onValueChange={(val) => setNewAddress({ ...newAddress, comuna: val })}
                                        disabled={!newAddress.region}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una comuna" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getComunas(newAddress.region).map((comuna) => (
                                                <SelectItem key={comuna} value={comuna}>
                                                    {comuna}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="calle">Calle y Número</Label>
                                <Input
                                    id="calle"
                                    value={newAddress.calle}
                                    onChange={(e) => setNewAddress({ ...newAddress, calle: e.target.value })}
                                    placeholder="Av. Siempre Viva 742"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="depto">Depto / Oficina (Opcional)</Label>
                                    <Input
                                        id="depto"
                                        value={newAddress.depto}
                                        onChange={(e) => setNewAddress({ ...newAddress, depto: e.target.value })}
                                        placeholder="Depto 101"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="telefono">Teléfono de contacto</Label>
                                    <Input
                                        id="telefono"
                                        value={newAddress.telefono}
                                        onChange={(e) => setNewAddress({ ...newAddress, telefono: e.target.value })}
                                        placeholder="+56 9 ..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Dirección
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((address) => (
                    <div
                        key={address.id}
                        className="border rounded-lg p-4 relative group hover:border-blue-500 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-blue-500 mt-1" />
                            <div>
                                <h3 className="font-semibold">{address.nombre_etiqueta || "Dirección"}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {address.calle} {address.depto && `, ${address.depto}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {address.comuna}, {address.region}
                                </p>
                                {address.telefono && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        📞 {address.telefono}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteAddress(address.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                {addresses.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No tienes direcciones guardadas.
                    </div>
                )}
            </div>
        </div>
    );
}
