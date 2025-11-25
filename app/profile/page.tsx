"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/profile/profile-form";
import { AddressManager } from "@/components/profile/address-manager";
import { PasswordForm } from "@/components/profile/password-form";
import { OrderHistory } from "@/components/profile/order-history";
import { Loader2, User, MapPin, Lock, ArrowLeft, Package } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login?redirect=/profile");
            } else {
                setIsLoading(false);
            }
        };
        checkUser();
    }, [router, supabase]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <div className="mb-6">
                <Link
                    href="/tienda"
                    className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver a la tienda</span>
                </Link>
            </div>
            <h1 className="text-3xl font-bold mb-8">Mi Perfil</h1>

            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Mis Datos</span>
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline">Mis Pedidos</span>
                    </TabsTrigger>
                    <TabsTrigger value="addresses" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="hidden sm:inline">Direcciones</span>
                    </TabsTrigger>
                    <TabsTrigger value="security" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        <span className="hidden sm:inline">Seguridad</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                    <ProfileForm />
                </TabsContent>

                <TabsContent value="orders">
                    <OrderHistory />
                </TabsContent>

                <TabsContent value="addresses">
                    <AddressManager />
                </TabsContent>

                <TabsContent value="security">
                    <PasswordForm />
                </TabsContent>
            </Tabs>
        </div>
    );
}
