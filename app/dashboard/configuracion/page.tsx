import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings, User, Bell, Lock, Palette } from "lucide-react";
import Link from "next/link";

export default async function ConfiguracionPage() {
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
            Configuración
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Ajustes de perfil y preferencias
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-zinc-500 to-zinc-600 rounded-full flex items-center justify-center mb-4">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Configuración del Sistema</CardTitle>
          <CardDescription>Esta función estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Aquí podrás personalizar tu perfil, gestionar notificaciones, configurar la seguridad de tu cuenta y personalizar la apariencia.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <User className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Perfil</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Bell className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Notificaciones</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Lock className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Seguridad</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Palette className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Apariencia</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
