"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function RecentCutsCarousel() {
  const [recentCuts, setRecentCuts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentCuts() {
      const baseUrl = "https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/cortes";
      const knownImages = [
        `${baseUrl}/cut1.png`,
        `${baseUrl}/cut2.png`,
        `${baseUrl}/cut3.png`,
        `${baseUrl}/cut4.png`,
        `${baseUrl}/cut5.png`,
        `${baseUrl}/cut6.png`,
        `${baseUrl}/cut7.png`,
      ];
      
      const validImages = [];
      
      for (const url of knownImages) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            validImages.push(url);
          }
        } catch (e) {
          console.log('Image not found:', url);
        }
      }
      
      setRecentCuts(validImages.slice(0, 5));
      setLoading(false);
    }

    fetchRecentCuts();
  }, []);

  if (loading) {
    return (
      <div className="w-full mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
          Cortes Recientes
        </h3>
        <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-zinc-200 dark:border-zinc-800">
          <Skeleton className="w-full h-full" />
        </div>
      </div>
    );
  }

  if (recentCuts.length === 0) {
    return (
      <div className="w-full mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
          Cortes Recientes
        </h3>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500 dark:text-zinc-400">No hay cortes disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
        Cortes Recientes
      </h3>
      
      <Carousel 
        opts={{ loop: true }} 
        className="w-full [&_.embla__slide]:transition-opacity [&_.embla__slide]:duration-500 [&_.embla__slide:not(.is-snapped)]:opacity-30"
      >
        <CarouselContent>
          {recentCuts.map((src, index) => (
            <CarouselItem key={index}>
              <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 shadow-lg">
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
