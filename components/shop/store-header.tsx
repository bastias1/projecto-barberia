"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/cart-button";
import { SearchInput } from "@/components/shop/search-input";
import { ModeToggle } from "@/components/mode-toggle";
import { ArrowLeft, LogIn, LogOut, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { getRolApp, isStaffRol, type RolApp } from "@/lib/roles";
import { useBarberia } from "@/components/barberia-provider";
import type { Barberia } from "@/lib/barberia";

interface UserProfile {
    nombre: string | null;
    apellido: string | null;
    profile_image: string | null;
    rol: RolApp | null;
}

/** Logo de la barbería (claro/oscuro) o su nombre si no tiene logo. */
function BarberiaLogo({ barberia }: { barberia: Barberia }) {
    if (!barberia.logo_url) {
        return <span className="display max-w-40 truncate text-xl">{barberia.nombre}</span>;
    }
    return (
        <span className="flex h-8 max-w-32 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- los logos pueden venir de cualquier host */}
            <img
                src={barberia.logo_url}
                alt={`Logo ${barberia.nombre}`}
                className={`h-full w-full object-contain object-left ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`}
            />
            {barberia.logo_oscuro_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={barberia.logo_oscuro_url}
                    alt={`Logo ${barberia.nombre}`}
                    className="hidden h-full w-full object-contain object-left dark:block"
                />
            )}
        </span>
    );
}

export function StoreHeader() {
    const barberia = useBarberia();
    const slug = barberia.slug;
    const [user, setUser] = useState<{ email?: string } | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
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
                    getRolApp(supabase, user.id, barberia.id_barberia),
                ]);
                setProfile(data ? { ...data, rol } : { nombre: null, apellido: null, profile_image: null, rol });
            }
            setLoading(false);
        }
        getUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- el cliente de Supabase se crea en cada render
    }, [barberia.id_barberia]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        router.refresh();
    };

    const usuario = loading ? (
        <div className="h-11 w-11 animate-pulse rounded-full bg-muted" aria-hidden="true" />
    ) : user ? (
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
                {isStaffRol(profile?.rol) && (
                    <>
                        <DropdownMenuItem asChild className="min-h-11">
                            <Link href={`/${slug}/dashboard`}><User className="mr-2 size-4" aria-hidden="true" />Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="min-h-11">
                            <Link href={`/${slug}/dashboard/configuracion`}><User className="mr-2 size-4" aria-hidden="true" />Mi cuenta</Link>
                        </DropdownMenuItem>
                    </>
                )}
                {profile?.rol === 'cliente' && (
                    <DropdownMenuItem asChild className="min-h-11">
                        <Link href={`/${slug}/profile`}><User className="mr-2 size-4" aria-hidden="true" />Mi perfil</Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="min-h-11 text-destructive focus:text-destructive">
                    <LogOut className="mr-2 size-4" aria-hidden="true" />Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ) : (
        <Button asChild className="h-11 px-3 sm:px-4">
            <Link href={`/login?barberia=${slug}&next=/${slug}/tienda`}>
                <LogIn className="size-4 sm:hidden" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Iniciar sesión</span>
            </Link>
        </Button>
    );

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex h-16 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1">
                        <Button asChild variant="ghost" className="-ml-3 size-11 p-0">
                            <Link href={`/${slug}`} aria-label="Volver al inicio de la barbería"><ArrowLeft className="size-5" aria-hidden="true" /></Link>
                        </Button>
                        <Link href={`/${slug}/tienda`} className="flex min-h-11 min-w-0 items-center"><BarberiaLogo barberia={barberia} /></Link>
                    </div>

                    <div className="hidden max-w-md flex-1 md:block"><SearchInput /></div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                        <ModeToggle />
                        <CartButton />
                        {usuario}
                    </div>
                </div>
                <div className="pb-3 md:hidden"><SearchInput /></div>
            </div>
        </header>
    );
}
