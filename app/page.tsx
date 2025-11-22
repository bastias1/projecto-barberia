import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { RecentCutsCarousel } from "@/components/recent-cuts-carousel";
import Link from "next/link";
import { Calendar, ShoppingBag, Clock, MapPin, Instagram, LogIn } from "lucide-react";

export default function Home() {

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 py-12 relative overflow-hidden">

      {/* Theme Toggle - Positioned at top right */}
      <div className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </div>

      {/* Login Link - Positioned at top left */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/login">
          <Button variant="ghost" className="gap-2">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Iniciar Sesión</span>
          </Button>
        </Link>
      </div>

      {/* --- CONTENIDO CENTRADO --- */}
      <div className="w-full max-w-md flex flex-col items-center relative z-10">

        {/* Profile Section */}
        <div className="flex flex-col items-center text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="w-80 h-48 mb-8 flex items-center justify-center relative">
            <img
              src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/BLACK.png"
              alt="Logo Barbería BENJVMIN"
              className="w-full h-full object-contain dark:hidden relative z-10"
            />
            <img
              src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/WHITE.png"
              alt="Logo Barbería BENJVMIN"
              className="w-full h-full object-contain hidden dark:block relative z-10"
            />
          </div>
          <Badge variant="secondary" className="mb-6 px-4 py-1">
            Barberia · Profesional · Premium
          </Badge>
          <p className="text-lg text-muted-foreground max-w-sm leading-relaxed">
            Tu estilo, nuestra pasión. <br />
            <span className="text-foreground font-medium">Descubre la excelencia.</span>
          </p>
        </div>

        {/* Main Links Section */}
        <div className="space-y-6 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 w-full">
          {/* Booking Button */}
          <Link href="/agendar" className="block group">
            <Card className="overflow-hidden border hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer">
              <CardContent className="p-6 flex items-center">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-secondary flex items-center justify-center mr-5 group-hover:scale-105 transition-transform duration-300">
                  <Calendar className="h-6 w-6 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold mb-1">
                    Agendar Cita
                  </h3>
                  <p className="text-sm text-muted-foreground">Reserva tu corte ahora</p>
                </div>
                <div className="text-foreground opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                  →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Webstore Button */}
          <Link href="/tienda" className="block group">
            <Card className="overflow-hidden border hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer">
              <CardContent className="p-6 flex items-center">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-secondary flex items-center justify-center mr-5 group-hover:scale-105 transition-transform duration-300">
                  <ShoppingBag className="h-6 w-6 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold mb-1">Tienda Online</h3>
                  <p className="text-sm text-muted-foreground">Productos premium</p>
                </div>
                <div className="text-foreground opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                  →
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Gallery Carousel - Recent Cuts */}
        <div className="w-full mb-12">
          <RecentCutsCarousel />
        </div>

        {/* Descripción de la Barbería*/}
        <Card className="mt-6 mb-6 border-2 dark:border-zinc-800 animate-in fade-in duration-700 w-full">
          <CardContent className="p-6 text-center space-y-3">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Sobre BENJVMIN
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
           BENJVMIN es una marca dedicada al corte de cabello con un enfoque a público masculino, llegando a un acuerdo mutuo entre el deseo y la realidad.
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Trabajamos con pasión, innovación y un compromiso constante por mejorar y brindar una experiencia premium y personalizada.
            </p>
          </CardContent>
        </Card>

        <Separator className="my-8 w-full" />

        {/* Info Section */}
        <Card className="mb-8 animate-in fade-in duration-700 delay-300 w-full bg-secondary/30 border-none">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              Información
            </h3>
            <div className="space-y-6">
              <div className="flex items-start group">
                <Clock className="h-5 w-5 mr-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Horario de Atención</p>
                  <p className="text-sm text-muted-foreground">Lun - Sáb: 9:00 AM - 8:00 PM</p>
                </div>
              </div>
              <div className="flex flex-col group">
                <div className="flex items-start mb-4">
                  <MapPin className="h-5 w-5 mr-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Ubicación</p>
                    <p className="text-sm text-muted-foreground">Haverbeck 1815, Valdivia</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border shadow-sm">
                  <iframe
                    title="Ubicación en Google Maps"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3238.866827182495!2d-73.240!3d-39.820!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9615ef8cba8f4c15%3A0x5c2b7ed6f1c2b7b5!2sHaverbeck%201815%2C%20Valdivia!5e0!3m2!1ses!2scl!4v1700000000000!5m2!1ses!2scl"
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <div className="flex justify-center gap-4 mb-12 animate-in fade-in duration-1000 delay-500">
          <Link href="https://www.instagram.com/benjvmin._/" target="_blank">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full hover:bg-foreground hover:text-background transition-all duration-300">
              <Instagram className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center animate-in fade-in duration-1000 delay-300 pb-8">
          <p className="text-sm text-muted-foreground">
            © 2025 Barbería BENJVMIN
          </p>
        </div>
      </div>
    </div>
  );
}
