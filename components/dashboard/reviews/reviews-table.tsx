"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Review {
    id: number;
    comentario: string;
    calificacion: number;
    guest_name?: string;
    usuario?: {
        nombre: string;
        apellido: string;
    };
    barbero?: {
        nombre: string;
        apellido: string;
    };
}

export function ReviewsTable() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const fetchReviews = async () => {
        try {
            const response = await fetch("/api/reviews");
            const data = await response.json();
            if (data.reviews) {
                setReviews(data.reviews);
            }
        } catch (error) {
            console.error("Error fetching reviews:", error);
            toast.error("Error al cargar reseñas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        try {
            const response = await fetch(`/api/reviews/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete review");
            }

            toast.success("Reseña eliminada correctamente");
            fetchReviews();
        } catch (error) {
            console.error("Error deleting review:", error);
            toast.error("Error al eliminar la reseña");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Calificación</TableHead>
                        <TableHead>Comentario</TableHead>
                        <TableHead>Barbero</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reviews.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                No hay reseñas registradas.
                            </TableCell>
                        </TableRow>
                    ) : (
                        reviews.map((review) => (
                            <TableRow key={review.id}>
                                <TableCell className="font-medium">
                                    {review.guest_name || (review.usuario?.nombre || "Anónimo")} {review.usuario?.apellido || ""}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                        <span>{review.calificacion}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate" title={review.comentario}>
                                    {review.comentario}
                                </TableCell>
                                <TableCell>
                                    {review.barbero ? (
                                        `${review.barbero.nombre} ${review.barbero.apellido}`
                                    ) : (
                                        <span className="text-muted-foreground italic">General</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción no se puede deshacer. La reseña será eliminada permanentemente.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDelete(review.id)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    {deletingId === review.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Eliminar"
                                                    )}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
