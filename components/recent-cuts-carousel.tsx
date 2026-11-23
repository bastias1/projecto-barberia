"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

/** Galería de trabajos de la barbería (URLs guardadas en barberia.galeria). */
export function RecentCutsCarousel({ imagenes }: { imagenes: string[] }) {
  if (imagenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No hay cortes disponibles</p>
      </div>
    );
  }

  return (
    <div className="w-full mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
      <Carousel
        opts={{ loop: true }}
        className="w-full [&_.embla__slide]:transition-opacity [&_.embla__slide]:duration-500 [&_.embla__slide:not(.is-snapped)]:opacity-30"
      >
        <CarouselContent>
          {imagenes.map((src, index) => (
            <CarouselItem key={src}>
              <div className="w-full aspect-square rounded-lg overflow-hidden border border-border">
                <img
                  src={src}
                  alt={`Corte reciente ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </div>
  );
}
