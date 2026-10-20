"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "./star-rating";
import type { ProductoResenable, TipoResena } from "@/lib/review-link";

interface ReviewLinkFormProps {
    tipo: TipoResena;
    id: number;
    token: string;
    /** Solo para pedidos: productos que se pueden calificar */
    productos?: ProductoResenable[];
}

function ReviewFields({ onSubmit }: { onSubmit: (calificacion: number, comentario: string) => Promise<boolean> }) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Por favor selecciona una calificación");
            return;
        }
        setLoading(true);
        const ok = await onSubmit(rating, comment);
        setLoading(false);
        if (ok) {
            setRating(0);
            setComment("");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-center py-1">
                <StarRating rating={rating} onRatingChange={setRating} size="lg" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="comentario" className="sr-only">Comentario</Label>
                <Textarea
                    id="comentario"
                    placeholder="Cuéntanos tu experiencia (opcional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={1000}
                    className="resize-none"
                />
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publicar reseña
            </Button>
        </div>
    );
}

export function ReviewLinkForm({ tipo, id, token, productos = [] }: ReviewLinkFormProps) {
    const [enviada, setEnviada] = useState(false);
    const [resenados, setResenados] = useState<Set<number>>(
        () => new Set(productos.filter((p) => p.yaResenado).map((p) => p.id_producto))
    );
    const [productoActivo, setProductoActivo] = useState<number | null>(
        productos.find((p) => !p.yaResenado)?.id_producto ?? null
    );

    const enviar = async (calificacion: number, comentario: string, idProducto?: number) => {
        try {
            const response = await fetch("/api/reviews/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo, id, token, calificacion, comentario, id_producto: idProducto }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || "No se pudo guardar la reseña");
                return false;
            }
            toast.success("¡Gracias por tu reseña!");
            return true;
        } catch {
            toast.error("No se pudo guardar la reseña");
            return false;
        }
    };

    if (tipo === "reserva") {
        if (enviada) {
            return (
                <div className="text-center py-4">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold">¡Gracias por tu opinión!</p>
                    <p className="text-sm text-muted-foreground mt-1">Nos ayuda a seguir mejorando.</p>
                </div>
            );
        }
        return <ReviewFields onSubmit={async (c, t) => { const ok = await enviar(c, t); if (ok) setEnviada(true); return ok; }} />;
    }

    const pendientes = productos.filter((p) => !resenados.has(p.id_producto));

    return (
        <div className="space-y-3">
            {productos.map((producto) => {
                const hecho = resenados.has(producto.id_producto);
                const activo = productoActivo === producto.id_producto;
                return (
                    <div key={producto.id_producto} className="rounded-lg border p-3">
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 text-left disabled:cursor-default"
                            onClick={() => setProductoActivo(producto.id_producto)}
                            disabled={hecho}
                        >
                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                                {producto.imagen_url ? (
                                    <Image src={producto.imagen_url} alt={producto.nombre} fill className="object-cover" />
                                ) : (
                                    <div className="flex h-full items-center justify-center">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <span className="flex-1 font-medium">{producto.nombre}</span>
                            {hecho && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        </button>
                        {activo && !hecho && (
                            <div className="mt-4">
                                <ReviewFields
                                    onSubmit={async (c, t) => {
                                        const ok = await enviar(c, t, producto.id_producto);
                                        if (ok) {
                                            const next = new Set(resenados).add(producto.id_producto);
                                            setResenados(next);
                                            setProductoActivo(productos.find((p) => !next.has(p.id_producto))?.id_producto ?? null);
                                        }
                                        return ok;
                                    }}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
            {pendientes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                    ¡Gracias! Ya calificaste todos los productos de este pedido.
                </p>
            )}
        </div>
    );
}
