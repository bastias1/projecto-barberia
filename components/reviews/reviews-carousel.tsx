"use client";

import { useEffect, useState } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { ReviewCard } from "./review-card";
import { Loader2 } from "lucide-react";
import { CreateReviewDialog } from "./create-review-dialog";

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

export function ReviewsCarousel() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = async () => {
        try {
            const response = await fetch("/api/reviews");
            const data = await response.json();
            if (data.reviews) {
                setReviews(data.reviews);
            }
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    const handleReviewCreated = () => {
        fetchReviews();
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full relative">
            <div className="flex justify-end mb-4 px-4">
                <CreateReviewDialog onReviewCreated={handleReviewCreated} />
            </div>

            {reviews.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                    <p>Aún no hay reseñas. ¡Sé el primero en opinar!</p>
                </div>
            ) : (
                <Carousel
                    opts={{
                        align: "start",
                        loop: true,
                    }}
                    className="w-full"
                >
                    <CarouselContent className="-ml-4">
                        {reviews.map((review) => (
                            <CarouselItem key={review.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
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
        </div>
    );
}
