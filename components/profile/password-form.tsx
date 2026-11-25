"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { avisarCambioSeguridad } from "@/app/cuenta/actions";
import { Vidrio } from "@/components/vidrio";

export function PasswordForm() {
    const [isSaving, setIsSaving] = useState(false);
    const [passwords, setPasswords] = useState({
        password: "",
        confirmPassword: "",
    });

    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.password !== passwords.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }
        if (passwords.password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.password,
            });

            if (error) throw error;

            avisarCambioSeguridad("clave").catch(() => {});
            toast.success("Contraseña actualizada correctamente");
            setPasswords({ password: "", confirmPassword: "" });
        } catch (error) {
            console.error("Error updating password:", error);
            toast.error("Error al actualizar la contraseña");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
          <Vidrio />
            <CardHeader>
                <CardTitle>Cambiar Contraseña</CardTitle>
                <CardDescription>
                    Asegúrate de usar una contraseña segura.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Nueva Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            value={passwords.password}
                            onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={passwords.confirmPassword}
                            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                            required
                        />
                    </div>

                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Actualizar Contraseña
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
