import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
    return (
        <div className="relative w-full h-[400px] md:h-[500px] bg-zinc-900 overflow-hidden rounded-2xl mb-8">
            {/* Background Image Placeholder - You can replace this with a real image */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1503951914875-befbb6470523?q=80&w=2068&auto=format&fit=crop')] bg-cover bg-center opacity-50" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            <div className="relative z-10 h-full flex flex-col justify-center items-start px-8 md:px-16 max-w-4xl">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                    Eleva tu Estilo
                </h1>
                <p className="text-lg md:text-xl text-zinc-200 mb-8 max-w-lg">
                    Descubre nuestra colección exclusiva de productos para el cuidado de barba y cabello. Calidad profesional en tus manos.
                </p>
                <Button asChild size="lg" className="bg-white text-black hover:bg-zinc-200 text-lg px-8 py-6 rounded-full">
                    <Link href="#catalogo">
                        Ver Catálogo
                    </Link>
                </Button>
            </div>
        </div>
    );
}
