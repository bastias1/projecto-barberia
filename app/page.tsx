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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black p-4 py-12 relative">

      {/* Theme Toggle - Positioned at top right */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      {/* Login Link - Positioned at top left */}
      <div className="absolute top-4 left-4">
        <Link href="/login">
          <Button variant="ghost" className="gap-2">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
        </Link>
      </div>

      {/* --- CONTENIDO CENTRADO --- */}
      <div className="w-full max-w-md flex flex-col items-center">

        {/* Profile Section */}
        <div className="flex flex-col items-center text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-80 h-48 mb-6 flex items-center justify-center">
            <img
              src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/BLACK.png"
              alt="Logo Barbería BENJVMIN"
              className="w-full h-full object-contain drop-shadow-2xl dark:hidden"
            />
            <img
              src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/WHITE.png"
              alt="Logo Barbería BENJVMIN"
              className="w-full h-full object-contain drop-shadow-2xl hidden dark:block"
            />
          </div>
          <Badge variant="secondary" className="mb-4">
            Barberia · Profesional · Premium
          </Badge>
          <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-sm">
            Tu estilo, nuestra pasión. Descubre nuestros servicios y productos.
          </p>
        </div>

        {/* Main Links Section */}
        <div className="space-y-4 mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 w-full">
          {/* Booking Button */}
          <Link href="/agendar" className="block">
            <Card className="overflow-hidden border-2 hover:border-blue-500 dark:hover:border-blue-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                      Agendar Cita
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Reserva tu corte ahora</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Webstore Button */}
          <Link href="/tienda" className="block">
            <Card className="overflow-hidden border-2 hover:border-purple-500 dark:hover:border-purple-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-4">
                    <ShoppingBag className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">Tienda Online</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Productos premium</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Gallery Carousel - Recent Cuts */}
        <RecentCutsCarousel />

        <Separator className="my-8 w-full" />

        {/* Info Section */}
        <Card className="mb-6 animate-in fade-in duration-700 delay-300 border-zinc-200 dark:border-zinc-800 w-full">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Información</h3>
            <div className="space-y-3">
              <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                <Clock className="h-5 w-5 mr-3 text-zinc-400" />
                <span className="text-sm">Lun - Sáb: 9:00 AM - 8:00 PM</span>
              </div>
              <div className="flex flex-col text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-3 text-zinc-400" />
                  <span className="text-sm">Haverbeck 1815, Valdivia</span>
                </div>
                <div className="mt-3 rounded-lg overflow-hidden">
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
        <div className="flex justify-center gap-3 mb-8 animate-in fade-in duration-1000 delay-500">
          <Link href="https://www.instagram.com/benjvmin._/" target="_blank">
            <Button variant="outline" size="icon" className="rounded-full hover:bg-pink-500 hover:text-white hover:border-pink-500 transition-all duration-300">
              <Instagram className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center animate-in fade-in duration-1000 delay-300">
          <p className="text-sm text-zinc-500 dark:text-zinc-600">
            © 2025 Barbería BENJVMIN
          </p>
        </div>
      </div>
    </div>
  );
}
