import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "./star-rating";
import { Vidrio } from "@/components/vidrio";

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
        <Card className="h-full border-border bg-card">
          <Vidrio />
            <CardContent className="p-6 flex flex-col h-full gap-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm text-foreground">
                                {review.autor}
                            </p>
                        </div>
                    </div>
                    <StarRating rating={review.calificacion} size="sm" readonly />
                </div>

                <div className="flex-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        &quot;{review.comentario}&quot;
                    </p>
                </div>

                {(review.profesional || review.producto) && (
                    <div className="pt-4 mt-auto border-t border-border">
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
