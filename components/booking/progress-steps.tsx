"use client"

import { Scissors, Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="flex justify-center mb-8">
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
          currentStep >= 1 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Scissors className="h-4 w-4" />
          <span className="text-sm font-medium">Servicio</span>
        </div>
        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
          currentStep >= 2 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">Fecha y Hora</span>
        </div>
        <div className="w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
          currentStep >= 3 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Confirmar</span>
        </div>
      </div>
    </div>
  );
}
