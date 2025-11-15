import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, Calendar as CalendarIcon, Sun, Moon } from "lucide-react";
import Link from "next/link";

export default async function HorariosPage() {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Horarios
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Configurar tu disponibilidad
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Gestión de Horarios</CardTitle>
          <CardDescription>Esta función estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Aquí podrás configurar tus horarios de trabajo, días libres y bloques de tiempo disponibles para reservas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <CalendarIcon className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Días Laborales</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Sun className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Horario Diurno</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Moon className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Días Libres</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
