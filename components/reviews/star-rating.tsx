import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
    rating: number;
    maxRating?: number;
    onRatingChange?: (rating: number) => void;
    readonly?: boolean;
    size?: "sm" | "md" | "lg";
}

export function StarRating({
    rating,
    maxRating = 5,
    onRatingChange,
    readonly = false,
    size = "md",
}: StarRatingProps) {
    const stars = Array.from({ length: maxRating }, (_, i) => i + 1);

    const sizeClasses = {
        sm: "h-3 w-3",
        md: "h-5 w-5",
        lg: "h-8 w-8",
    };

    return (
        <div className="flex items-center gap-1">
            {stars.map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => !readonly && onRatingChange?.(star)}
                    disabled={readonly}
                    className={cn(
                        "transition-all hover:scale-110 focus:outline-none",
                        readonly ? "cursor-default" : "cursor-pointer"
                    )}
                >
                    <Star
                        className={cn(
                            sizeClasses[size],
                            star <= rating
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted-foreground/20"
                        )}
                    />
                </button>
            ))}
        </div>
    );
}
