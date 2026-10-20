"use client"

import { User, Scissors, Calendar, Check, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStepsProps {
  currentStep: number;
  // Barberías con varias sucursales parten eligiendo sucursal (paso 0)
  conSucursal?: boolean;
}

export function ProgressSteps({ currentStep, conSucursal = false }: ProgressStepsProps) {
  return (
    <div className="flex justify-center mb-8 px-2 overflow-x-auto">
      <div className="flex items-center gap-2 md:gap-4">
        {conSucursal && (
          <>
            {/* Step 0: Sucursal */}
            <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all whitespace-nowrap bg-blue-500 text-white">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs md:text-sm font-medium hidden sm:inline">Sucursal</span>
            </div>

            {/* Divider */}
            <div className="w-4 md:w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
          </>
        )}

        {/* Step 1: Barber */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all whitespace-nowrap",
          currentStep >= 1 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <User className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Barbero</span>
        </div>
        
        {/* Divider */}
        <div className="w-4 md:w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        
        {/* Step 2: Service */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all whitespace-nowrap",
          currentStep >= 2 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Scissors className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Servicio</span>
        </div>
        
        {/* Divider */}
        <div className="w-4 md:w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        
        {/* Step 3: Date & Time */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all whitespace-nowrap",
          currentStep >= 3 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Fecha</span>
        </div>
        
        {/* Divider */}
        <div className="w-4 md:w-8 h-0.5 bg-zinc-300 dark:bg-zinc-700" />
        
        {/* Step 4: Confirm */}
        <div className={cn(
          "flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-full transition-all whitespace-nowrap",
          currentStep >= 4 ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
        )}>
          <Check className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs md:text-sm font-medium hidden sm:inline">Confirmar</span>
        </div>
      </div>
    </div>
  );
}
