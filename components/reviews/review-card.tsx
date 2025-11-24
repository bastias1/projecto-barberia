import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "./star-rating";

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

interface ReviewCardProps {
    review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
    const nombre = review.guest_name || review.usuario?.nombre || "Anónimo";
    const apellido = review.usuario?.apellido || "";
    const initials = `${nombre[0] || "?"}${apellido[0] || ""}`;
    const fullName = review.guest_name || `${nombre} ${apellido}`;

    return (
        <Card className="h-full border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
            <CardContent className="p-6 flex flex-col h-full gap-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-700">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                {fullName}
                            </p>
                        </div>
                    </div>
                    <StarRating rating={review.calificacion} size="sm" readonly />
                </div>

                <div className="flex-1">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                        "{review.comentario}"
                    </p>
                </div>

                {review.barbero && (
                    <div className="pt-4 mt-auto border-t border-zinc-100 dark:border-zinc-800/50">
                        <p className="text-xs text-muted-foreground">
                            Atendido por <span className="font-medium text-primary">{review.barbero.nombre} {review.barbero.apellido}</span>
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
