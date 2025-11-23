"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StarRating } from "./star-rating";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";

interface CreateReviewDialogProps {
    onReviewCreated: () => void;
}

interface Barber {
    id: string;
    nombre: string;
    apellido: string;
}

export function CreateReviewDialog({ onReviewCreated }: CreateReviewDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [name, setName] = useState("");
    const [barberId, setBarberId] = useState<string>("none");
    const [barbers, setBarbers] = useState<Barber[]>([]);

    const supabase = createClient();

    useEffect(() => {
        fetchBarbers();
    }, []);

    const fetchBarbers = async () => {
        const { data } = await supabase
            .from("barbero")
            .select("id, nombre, apellido");
        if (data) {
            setBarbers(data);
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Por favor selecciona una calificación");
            return;
        }

        if (!name.trim()) {
            toast.error("Por favor ingresa tu nombre");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/api/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    comentario: comment,
                    calificacion: rating,
                    barbero_id: barberId === "none" ? null : barberId,
                    guest_name: name.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Error al crear la reseña");
            }

            toast.success("¡Gracias por tu reseña!");
            setOpen(false);
            setRating(0);
            setComment("");
            setName("");
            setBarberId("none");
            onReviewCreated();
        } catch (error) {
            console.error("Error creating review:", error);
            toast.error("Hubo un error al enviar tu reseña");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <MessageSquarePlus className="h-4 w-4" />
                    Dejar Reseña
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Dejar una Reseña</DialogTitle>
                    <DialogDescription>
                        Cuéntanos sobre tu experiencia. Tu opinión nos ayuda a mejorar.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="name">Tu Nombre</Label>
                        <Input
                            id="name"
                            placeholder="Ingresa tu nombre"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Calificación</Label>
                        <div className="flex justify-center py-2">
                            <StarRating rating={rating} onRatingChange={setRating} size="lg" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="barber">Barbero (Opcional)</Label>
                        <Select value={barberId} onValueChange={setBarberId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un barbero" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">General (Tienda)</SelectItem>
                                {barbers.map((barber) => (
                                    <SelectItem key={barber.id} value={barber.id}>
                                        {barber.nombre} {barber.apellido}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="comment">Comentario</Label>
                        <Textarea
                            id="comment"
                            placeholder="Escribe tu comentario aquí..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Enviando..." : "Publicar Reseña"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
