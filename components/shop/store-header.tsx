"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/components/cart-button";
import { SearchInput } from "@/components/shop/search-input";
import { ModeToggle } from "@/components/mode-toggle";
import { ArrowLeft, LogIn, User, LogOut, ShoppingBag, Menu, ChevronDown } from "lucide-react";
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getRolApp, isStaffRol, type RolApp } from "@/lib/roles";
import { useBarberia } from "@/components/barberia-provider";
import type { Barberia } from "@/lib/barberia";

interface UserProfile {
    nombre: string | null;
    apellido: string | null;
    profile_image: string | null;
    rol: RolApp | null;
}

// Rutas relativas a /<slug>
const categories = [
    { name: "Todos", href: "/tienda?categoria=Todos" },
    { name: "Barba", href: "/tienda?categoria=Barba" },
    { name: "Cabello", href: "/tienda?categoria=Cabello" },
    { name: "Styling", href: "/tienda?categoria=Styling" },
    { name: "Packs", href: "/tienda?categoria=Pack" },
];

/** Logo de la barbería (claro/oscuro) o su nombre si no tiene logo. */
function BarberiaLogo({ barberia, className }: { barberia: Barberia; className: string }) {
    if (!barberia.logo_url) {
        return <span className="font-bold text-lg truncate max-w-48">{barberia.nombre}</span>;
    }
    return (
        <div className={className}>
            <img
                src={barberia.logo_url}
                alt={`Logo ${barberia.nombre}`}
                className={`h-full w-full object-contain object-left ${barberia.logo_oscuro_url ? "dark:hidden" : ""}`}
            />
            {barberia.logo_oscuro_url && (
                <img
                    src={barberia.logo_oscuro_url}
                    alt={`Logo ${barberia.nombre}`}
                    className="h-full w-full object-contain object-left hidden dark:block"
                />
            )}
        </div>
    );
}

export function StoreHeader() {
    const barberia = useBarberia();
    const slug = barberia.slug;
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
    }, [barberia.id_barberia]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        router.refresh();
    };

    const UserMenu = () => (
        loading ? (
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
                    {isStaffRol(profile?.rol) && (
                        <>
                            <DropdownMenuItem asChild>
                                <Link href={`/${slug}/dashboard`}>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Dashboard</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/${slug}/dashboard/configuracion`}>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Mi Cuenta</span>
                                </Link>
                            </DropdownMenuItem>
                        </>
                    )}
                    {profile?.rol === 'cliente' && (
                        <DropdownMenuItem asChild>
                            <Link href={`/${slug}/profile`}>
                                <User className="mr-2 h-4 w-4" />
                                <span className="mr-2">Mi Perfil</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ) : (
            <div className="flex items-center gap-2">
                <Link href={`/login?barberia=${slug}&next=/${slug}/tienda`}>
                    <Button variant="default" size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                        Iniciar Sesión
                    </Button>
                </Link>
            </div>
        )
    );

    return (
        <div className="mb-8">
            <StoreHeaderDesktop UserMenu={UserMenu} barberia={barberia} />
            <StoreHeaderMobile UserMenu={UserMenu} barberia={barberia} />
        </div>
    );
}

function StoreHeaderDesktop({ UserMenu, barberia }: { UserMenu: React.FC; barberia: Barberia }) {
    return (
        <header className="hidden lg:flex items-center justify-between gap-8 py-4">
            {/* Left: Logo & Back Link */}
            <div className="flex items-center gap-8 shrink-0">
                <Link
                    href={`/${barberia.slug}`}
                    className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden xl:inline">Inicio</span>
                </Link>

                <BarberiaLogo barberia={barberia} className="relative h-10 w-32" />
            </div>

            {/* Center: Search & Categories */}
            <div className="flex-1 max-w-2xl flex items-center gap-4">
                <div className="flex-1">
                    <SearchInput />
                </div>

                {/* Custom Hover Menu */}
                <div className="relative group shrink-0">
                    <Button variant="ghost" className="gap-2 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <ShoppingBag className="h-4 w-4" />
                        <span className="font-medium">Categorías</span>
                        <ChevronDown className="h-3 w-3 opacity-50 group-hover:rotate-180 transition-transform" />
                    </Button>

                    {/* Dropdown Content */}
                    <div className="absolute top-full right-0 pt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-2 overflow-hidden">
                            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 px-2 py-1.5 mb-1">
                                Explorar
                            </div>
                            {categories.map((category) => (
                                <Link
                                    key={category.name}
                                    href={`/${barberia.slug}${category.href}`}
                                    className="block px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    {category.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
                <ModeToggle />
                <CartButton />
                <UserMenu />
            </div>
        </header>
    );
}

function StoreHeaderMobile({ UserMenu, barberia }: { UserMenu: React.FC; barberia: Barberia }) {
    return (
        <header className="lg:hidden flex flex-col gap-4 py-4">
            {/* Top Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Sidebar Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="-ml-2">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="flex flex-col h-full w-[85vw] sm:w-[350px]">
                            <SheetHeader className="text-left px-2">
                                <SheetTitle className="text-2xl font-bold">Menú</SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-2">
                                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                                    Categorías
                                </div>
                                {categories.map((category) => (
                                    <Link
                                        key={category.name}
                                        href={`/${barberia.slug}${category.href}`}
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
                                    >
                                        <span className="text-base font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white">
                                            {category.name}
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 -rotate-90" />
                                    </Link>
                                ))}

                                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-4" />

                                <Link
                                    href={`/${barberia.slug}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                    <span className="font-medium">Volver al Inicio</span>
                                </Link>
                            </div>

                            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 pb-2 px-2">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Apariencia</span>
                                    <ModeToggle />
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Logo */}
                    <BarberiaLogo barberia={barberia} className="relative h-8 w-32" />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    <CartButton />
                    <UserMenu />
                </div>
            </div>

            {/* Bottom Row: Search */}
            <div className="w-full">
                <SearchInput />
            </div>
        </header>
    );
}
