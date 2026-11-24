"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/utils/supabase/client";
import { resolverAcceso } from "@/lib/acceso";

interface Sesion {
  cargando: boolean;
  email?: string;
  nombre?: string | null;
  apellido?: string | null;
  imagen?: string | null;
  /** Destino del panel (dashboard, /admin o /cuenta); null sin sesión. */
  destino: string | null;
}

/** Sesión del navegador para las páginas de la plataforma (sin barbería en la URL). */
export function useSesion(): Sesion {
  const [sesion, setSesion] = useState<Sesion>({ cargando: true, destino: null });

  useEffect(() => {
    const supabase = createClient();
    let activo = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (activo) setSesion({ cargando: false, destino: null });
        return;
      }
      const [{ data: perfil }, acceso] = await Promise.all([
        supabase.from("usuario").select("nombre, apellido, profile_image").eq("id_usuario", user.id).maybeSingle(),
        resolverAcceso(supabase, user.id),
      ]);
      if (activo) {
        setSesion({
          cargando: false,
          email: user.email,
          nombre: perfil?.nombre,
          apellido: perfil?.apellido,
          imagen: perfil?.profile_image,
          destino: acceso.destino,
        });
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  return sesion;
}

/** Avatar con menú de cuenta (igual que el de las páginas de una barbería) o "Iniciar sesión" si no hay sesión. */
export function MenuCuenta({ sesion, soloConSesion = false }: { sesion: Sesion; soloConSesion?: boolean }) {
  const router = useRouter();

  if (sesion.cargando) return soloConSesion ? null : <div className="size-11 animate-pulse rounded-full bg-muted" aria-hidden="true" />;

  if (sesion.destino === null) {
    return soloConSesion ? null : (
      <Button asChild variant="ghost" className="hidden h-11 md:inline-flex">
        <Link href="/login">Iniciar sesión</Link>
      </Button>
    );
  }

  const cerrarSesion = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-11 rounded-full p-0" aria-label="Mi cuenta">
          <Avatar className="size-9">
            <AvatarImage src={sesion.imagen || undefined} alt="" />
            <AvatarFallback>
              {sesion.nombre ? sesion.nombre[0].toUpperCase() : <User className="size-4" aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">{sesion.nombre} {sesion.apellido}</p>
          <p className="mt-1 break-all text-xs leading-none text-muted-foreground">{sesion.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/cuenta"><User className="mr-2 size-4" aria-hidden="true" />Mi cuenta</Link>
        </DropdownMenuItem>
        {sesion.destino !== "/cuenta" && (
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={sesion.destino}><LayoutDashboard className="mr-2 size-4" aria-hidden="true" />Mi panel</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={cerrarSesion} className="min-h-11 text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" aria-hidden="true" />Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
