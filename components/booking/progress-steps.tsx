"use client"

import { Scissors, Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="flex justify-center mb-8 px-2">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Step 1 */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all",
          currentStep >= 1 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Scissors className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Servicio</span>
        </div>
        
        {/* Divider */}
        <div className="w-4 md:w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        
        {/* Step 2 */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all",
          currentStep >= 2 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Fecha</span>
        </div>
        
        {/* Divider */}
        <div className="w-4 md:w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        
        {/* Step 3 */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all",
          currentStep >= 3 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Check className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Confirmar</span>
        </div>
      </div>
    </div>
  );
}
