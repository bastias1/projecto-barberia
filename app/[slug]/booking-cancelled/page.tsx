import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import Link from "next/link";

export default async function BookingCancelledPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-black flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-2">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">
            Cita Cancelada
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Tu cita ha sido cancelada exitosamente. Lamentamos que no puedas asistir.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Si deseas reagendar, puedes crear una nueva reserva en cualquier momento.
          </p>
          <Link href={`/${slug}/agendar`}>
            <Button className="w-full">
              Agendar Nueva Cita
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
