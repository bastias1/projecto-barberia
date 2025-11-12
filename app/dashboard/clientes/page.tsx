import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, UserCircle, Phone, Mail } from "lucide-react";
import Link from "next/link";

export default async function ClientesPage() {
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
            Mis Clientes
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Historial y gestión de clientes
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Gestión de Clientes</CardTitle>
          <CardDescription>Esta función estará disponible próximamente</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Aquí podrás ver el historial completo de tus clientes, sus reservas anteriores y gestionar su información de contacto.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <UserCircle className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Perfiles de Clientes</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Phone className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Información de Contacto</p>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <Mail className="h-8 w-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-medium">Historial de Citas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
