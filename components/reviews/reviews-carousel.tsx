"use client";

import { useEffect, useState } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { ReviewCard, type PublicReview } from "./review-card";
import { Loader2 } from "lucide-react";
import { useBarberia } from "@/components/barberia-provider";

export function ReviewsCarousel() {
    const { slug } = useBarberia();
    const [reviews, setReviews] = useState<PublicReview[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const response = await fetch(`/api/reviews?barberia=${slug}&limit=20`);
                const data = await response.json();
                if (data.reviews) {
                    // En el carrusel solo se muestran reseñas con comentario
                    setReviews(data.reviews.filter((r: PublicReview) => r.comentario).slice(0, 10));
                }
            } catch (error) {
                console.error("Error fetching reviews:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [slug]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full relative">
            {reviews.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground rounded-xl border border-dashed border-border">
                    <p>Aún no hay reseñas.</p>
                </div>
            ) : (
                <Carousel
                    opts={{
                        align: "start",
                        loop: true,
                    }}
                    // clip con margen en vez de hidden: deja salir el brillo de las tarjetas (24px, lo mismo que las separa)
                    className="w-full [&_[data-slot=carousel-content]]:overflow-clip [&_[data-slot=carousel-content]]:[overflow-clip-margin:1.5rem]"
                >
                    <CarouselContent className="-ml-6">
                        {reviews.map((review) => (
                            <CarouselItem key={review.id} className="pl-6 md:basis-1/2 lg:basis-1/3">
                                <ReviewCard review={review} />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <div className="hidden md:block">
                        <CarouselPrevious className="-left-12" />
                        <CarouselNext className="-right-12" />
                    </div>
                </Carousel>
            )}

            <p className="text-center text-xs text-muted-foreground mt-4">
                Después de tu cita o compra te enviaremos un correo para que dejes tu opinión.
            </p>
        </div>
    );
}
