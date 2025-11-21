"use client"

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/cart-button";
import { SearchInput } from "@/components/shop/search-input";
import { ModeToggle } from "@/components/mode-toggle";
import { ArrowLeft, LogIn, User, LogOut, ShoppingBag } from "lucide-react";
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

interface UserProfile {
    nombre: string | null;
    apellido: string | null;
    profile_image: string | null;
    rol: string | null;
}

export function StoreHeader() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const { data } = await supabase
                    .from('usuario')
                    .select('nombre, apellido, profile_image, rol')
                    .eq('id', user.id)
                    .single();
                setProfile(data);
            }
            setLoading(false);
        }
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        router.refresh();
    };

    return (
        <header className="grid grid-cols-1 md:grid-cols-3 items-center mb-8 gap-4">
            {/* Left: Navigation & Logo */}
            <div className="flex items-center justify-start gap-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Inicio</span>
                </Link>

                <div className="w-12 h-12 relative">
                    <Image
                        src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/BLACK.png"
                        alt="Barbería BENJVMIN Logo"
                        fill
                        className="object-contain dark:hidden"
                        priority
                    />
                    <Image
                        src="https://iuhmjpqwkueueakybgaz.supabase.co/storage/v1/object/public/imgs/logo/WHITE.png"
                        alt="Barbería BENJVMIN Logo"
                        fill
                        className="object-contain hidden dark:block"
                        priority
                    />
                </div>
            </div>

            {/* Center: Search */}
            <div className="flex justify-center w-full order-last md:order-none col-span-1 md:col-span-1">
                <div className="w-full max-w-md">
                    <SearchInput />
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-3">
                <ModeToggle />
                <CartButton />

                {loading ? (
                    <div className="h-9 w-20 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-md" />
                ) : user ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={profile?.profile_image || undefined} alt={profile?.nombre || "Usuario"} />
                                    <AvatarFallback>
                                        {profile?.nombre ? profile.nombre[0].toUpperCase() : <User className="h-4 w-4" />}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {profile?.nombre} {profile?.apellido}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(profile?.rol === 'admin' || profile?.rol === 'owner' || profile?.rol === 'barbero') && (
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard">
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Dashboard</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/configuracion">
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Mi Cuenta</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/tienda">
                                    <ShoppingBag className="mr-2 h-4 w-4" />
                                    <span>Mis Pedidos</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Cerrar Sesión</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link href="/login">
                            <Button variant="default" size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                                Iniciar Sesión
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
}
