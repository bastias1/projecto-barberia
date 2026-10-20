import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "./star-rating";

export interface PublicReview {
    id: number;
    comentario: string | null;
    calificacion: number;
    created_at: string;
    autor: string;
    profesional: string | null;
    servicio: string | null;
    producto: string | null;
}

interface ReviewCardProps {
    review: PublicReview;
}

export function ReviewCard({ review }: ReviewCardProps) {
    const initials = review.autor
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

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
                                {review.autor}
                            </p>
                        </div>
                    </div>
                    <StarRating rating={review.calificacion} size="sm" readonly />
                </div>

                <div className="flex-1">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                        &quot;{review.comentario}&quot;
                    </p>
                </div>

                {(review.profesional || review.producto) && (
                    <div className="pt-4 mt-auto border-t border-zinc-100 dark:border-zinc-800/50">
                        <p className="text-xs text-muted-foreground">
                            {review.producto ? (
                                <>Sobre <span className="font-medium text-primary">{review.producto}</span></>
                            ) : (
                                <>Atendido por <span className="font-medium text-primary">{review.profesional}</span></>
                            )}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
