"use client"

import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogIn, LogOut, User, CalendarDays } from "lucide-react";
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
import { getRolApp, isStaffRol, type RolApp } from "@/lib/roles";
import { useBarberia } from "@/components/barberia-provider";
import { MuestraContext } from "@/components/vista-previa";

interface UserProfile {
    nombre: string | null;
    apellido: string | null;
    profile_image: string | null;
    rol: RolApp | null;
}

/** Login o menú de la cuenta (Mi cuenta, Dashboard si es staff, Cerrar sesión) para las páginas de una barbería. */
export function BarberiaUserMenu() {
    const { slug, id_barberia } = useBarberia();
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ email?: string } | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    // En las páginas de ejemplo de la vista previa no se consulta la sesión
    const muestra = useContext(MuestraContext);

    useEffect(() => {
        if (muestra) return;
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const [{ data }, rol] = await Promise.all([
                    supabase
                        .from('usuario')
                        .select('nombre, apellido, profile_image')
                        .eq('id_usuario', user.id)
                        .maybeSingle(),
                    getRolApp(supabase, user.id, id_barberia),
                ]);
                setProfile(data ? { ...data, rol } : { nombre: null, apellido: null, profile_image: null, rol });
            }
            setLoading(false);
        }
        getUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- el cliente de Supabase se crea en cada render
    }, [id_barberia, muestra]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        router.refresh();
    };

    if (muestra) return <div className="size-11 rounded-full bg-muted" aria-hidden="true" />;
    if (loading) return <div className="size-11 animate-pulse rounded-full bg-muted" aria-hidden="true" />;

    if (!user) {
        return (
            <Button asChild variant="ghost" className="h-11 px-3">
                <Link href={`/login?barberia=${slug}&next=${encodeURIComponent(pathname)}`}>
                    <LogIn className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Iniciar sesión</span>
                    <span className="sr-only sm:hidden">Iniciar sesión</span>
                </Link>
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="size-11 rounded-full p-0" aria-label="Mi cuenta">
                    <Avatar className="size-9">
                        <AvatarImage src={profile?.profile_image || undefined} alt="" />
                        <AvatarFallback>
                            {profile?.nombre ? profile.nombre[0].toUpperCase() : <User className="size-4" aria-hidden="true" />}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium leading-none">{profile?.nombre} {profile?.apellido}</p>
                    <p className="mt-1 break-all text-xs leading-none text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="min-h-11">
                    <Link href="/cuenta"><User className="mr-2 size-4" aria-hidden="true" />Mi cuenta</Link>
                </DropdownMenuItem>
                {isStaffRol(profile?.rol) && (
                    <DropdownMenuItem asChild className="min-h-11">
                        <Link href={`/${slug}/dashboard`}><LayoutDashboard className="mr-2 size-4" aria-hidden="true" />Dashboard</Link>
                    </DropdownMenuItem>
                )}
                {profile?.rol === 'cliente' && (
                    <DropdownMenuItem asChild className="min-h-11">
                        <Link href={`/${slug}/profile`}><CalendarDays className="mr-2 size-4" aria-hidden="true" />Mis reservas</Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="min-h-11 text-destructive focus:text-destructive">
                    <LogOut className="mr-2 size-4" aria-hidden="true" />Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
