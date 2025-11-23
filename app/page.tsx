import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { RecentCutsCarousel } from "@/components/recent-cuts-carousel";
import Link from "next/link";
import { Calendar, ShoppingBag, Clock, MapPin, Instagram, LogIn, Scissors, Star } from "lucide-react";

export default function Home() {

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden selection:bg-primary/20">

      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mb-16 lg:mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="relative w-full max-w-3xl mx-auto mb-8">
            <div className="aspect-[3/1] relative flex items-center justify-center">
              <img
                src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/BLACK.png"
                alt="Logo Barbería BENJVMIN"
                className="h-32 sm:h-48 object-contain dark:hidden drop-shadow-2xl"
              />
              <img
                src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/WHITE.png"
                alt="Logo Barbería BENJVMIN"
                className="h-32 sm:h-48 object-contain hidden dark:block drop-shadow-2xl"
              />
            </div>
          </div>

          <Badge variant="outline" className="mb-6 px-6 py-1.5 text-sm uppercase tracking-widest border-primary/20 bg-primary/5">
            Barberia · Profesional · Premium
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-white dark:via-zinc-400 dark:to-white">
            Tu estilo, nuestra pasión.
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
            Descubre la excelencia en cada corte. Una experiencia diseñada para el hombre moderno.
          </p>
        </div>

        {/* Primary Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-16 max-w-4xl mx-auto">
          {/* Booking Card */}
          <Link href="/agendar" className="group h-full">
            <Card className="h-full overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 group-hover:border-primary/50 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-6 flex flex-col items-center text-center h-full justify-center relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <Calendar className="h-8 w-8 text-zinc-900 dark:text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">Agendar Cita</h3>
                <p className="text-sm text-muted-foreground mb-4">Reserva tu momento de cuidado personal en segundos.</p>
                <div className="mt-auto flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  Reservar Ahora <span className="ml-2">→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Store Card */}
          <Link href="/tienda" className="group h-full">
            <Card className="h-full overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 group-hover:border-blue-500/50 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-6 flex flex-col items-center text-center h-full justify-center relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <ShoppingBag className="h-8 w-8 text-zinc-900 dark:text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-blue-500 transition-colors">Tienda Online</h3>
                <p className="text-sm text-muted-foreground mb-4">Productos premium seleccionados para tu rutina.</p>
                <div className="mt-auto flex items-center text-sm font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  Ver Productos <span className="ml-2">→</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Cuts Section */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-8 px-2 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Trabajos Recientes
            </h2>
            <Badge variant="secondary">Galería</Badge>
          </div>
          <div className="max-w-3xl mx-auto">
            <RecentCutsCarousel />
          </div>
        </div>

        {/* Bento Grid Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">

          {/* About Section - Spans 2 cols */}
          <Card className="lg:col-span-2 border-none bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-32 bg-zinc-200/50 dark:bg-zinc-800/20 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-zinc-300/50 dark:group-hover:bg-zinc-700/20" />
            <CardContent className="p-8 relative z-10 h-full flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-bold tracking-wider text-sm uppercase">Sobre Nosotros</span>
              </div>
              <h3 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
                Sobre BENJVMIN
              </h3>
              <div className="space-y-4 text-lg text-muted-foreground leading-relaxed">
                <p>
                  BENJVMIN es una marca dedicada al corte de cabello con un enfoque a público masculino, llegando a un acuerdo mutuo entre el deseo y la realidad.
                </p>
                <p>
                  Trabajamos con pasión, innovación y un compromiso constante por mejorar y brindar una experiencia premium y personalizada.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Stack - Spans 1 col */}
          <div className="space-y-6 flex flex-col h-full">
            {/* Hours */}
            <Card className="flex-1 border-none bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <CardContent className="p-6 flex items-start gap-4 h-full">
                <div className="p-3 rounded-xl bg-background shadow-sm">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">Horario</h4>
                  <p className="text-muted-foreground">Lun - Sáb</p>
                  <p className="font-medium text-lg">9:00 AM - 8:00 PM</p>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="flex-[2] border-none bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="p-6 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-background shadow-sm">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Ubicación</h4>
                    <p className="text-muted-foreground">Haverbeck 1815, Valdivia</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[150px] relative grayscale hover:grayscale-0 transition-all duration-500">
                  <iframe
                    title="Ubicación en Google Maps"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3238.866827182495!2d-73.240!3d-39.820!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9615ef8cba8f4c15%3A0x5c2b7ed6f1c2b7b5!2sHaverbeck%201815%2C%20Valdivia!5e0!3m2!1ses!2scl!4v1700000000000!5m2!1ses!2scl"
                    width="100%"
                    height="100%"
                    style={{ border: 0, position: 'absolute', inset: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="my-12" />

        {/* Footer Section */}
        <footer className="flex flex-col items-center justify-center gap-8 pb-8">
          <div className="flex gap-6">
            <Link href="https://www.instagram.com/benjvmin._/" target="_blank" className="group">
              <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-900 group-hover:bg-pink-600 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:shadow-pink-600/20">
                <Instagram className="h-6 w-6" />
              </div>
            </Link>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              © 2025 Barbería BENJVMIN
            </p>
          </div>
        </footer>

      </main>
    </div>
  );
}
