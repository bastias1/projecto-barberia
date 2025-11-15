"use client"

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <svg 
              className="w-10 h-10 text-red-600 dark:text-red-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">Error</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">Algo salió mal. Por favor, intenta de nuevo.</p>
        <Link href="/">
          <Button>Volver al Inicio</Button>
        </Link>
      </div>
    </div>
  );
}
