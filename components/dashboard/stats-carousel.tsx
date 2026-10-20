"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { STAT_ICONS, type StatItem } from "./stat-icons";

/** En móvil las estadísticas son una sola card que se desliza. */
export function StatsCarousel({ stats }: { stats: StatItem[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [actual, setActual] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActual(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  return (
    <div className="space-y-3">
      <Carousel opts={{ loop: true }} setApi={setApi} aria-label="Estadísticas">
        <CarouselContent>
          {stats.map((stat) => {
            const Icon = STAT_ICONS[stat.icon];
            return (
              <CarouselItem key={stat.title}>
                <Card className="shadow-sm select-none">
                  <CardContent className="p-6 flex items-center justify-between gap-4 min-h-36">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-4xl font-bold mt-2 truncate">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                    </div>
                    <div className={cn("p-4 rounded-full flex-shrink-0", stat.bgColor)}>
                      <Icon className={cn("h-8 w-8", stat.color)} />
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Indicadores: uno por estadística */}
      <div className="flex justify-center gap-2">
        {stats.map((stat, i) => (
          <button
            key={stat.title}
            type="button"
            onClick={() => api?.scrollTo(i)}
            aria-label={`Ver ${stat.title}`}
            aria-current={i === actual}
            className={cn(
              "h-2 rounded-full transition-all",
              i === actual ? "w-6 bg-primary" : "w-2 bg-zinc-300 dark:bg-zinc-700"
            )}
          />
        ))}
      </div>
    </div>
  );
}
