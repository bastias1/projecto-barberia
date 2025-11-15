"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  userId: string;
  initialData: {
    nombre: string;
    apellido: string;
    telefono: string;
    correo: string;
    especialidad?: string;
    rol: string;
  };
}

export function ProfileForm({ userId, initialData }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialData);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update usuario table
      const { error: userError } = await supabase
        .from('usuario')
        .update({
          nombre: formData.nombre,
          apellido: formData.apellido,
          telefono: formData.telefono,
        })
        .eq('id', userId);

      if (userError) throw userError;

      // Update auth email if changed
      if (formData.correo !== initialData.correo) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.correo,
        });

        if (emailError) throw emailError;
      }

      // Update barbero table if user is a barber
      if (initialData.rol === 'barbero' && formData.especialidad !== undefined) {
        const { error: barberError } = await supabase
          .from('barbero')
          .update({
            especialidad: formData.especialidad,
          })
          .eq('id', userId);

        if (barberError) throw barberError;
      }

      alert('Perfil actualizado correctamente');
      router.refresh();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error al actualizar el perfil. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={formData.nombre}
            disabled
            className="bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apellido">Apellido</Label>
          <Input
            id="apellido"
            value={formData.apellido}
            disabled
            className="bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            type="tel"
            value={formData.telefono}
            onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="correo">Correo Electrónico</Label>
          <Input
            id="correo"
            type="email"
            value={formData.correo}
            onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
            required
          />
        </div>

        {initialData.rol === 'barbero' && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="especialidad">Especialidad</Label>
            <Input
              id="especialidad"
              value={formData.especialidad || ''}
              onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
              placeholder="Ej: Cortes clásicos, Fade, Barba..."
            />
          </div>
        )}
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar Cambios'
        )}
      </Button>
    </form>
  );
}
