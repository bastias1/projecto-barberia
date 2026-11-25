"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import { ImagenInput, subirImagen } from "@/components/dashboard/imagen-input";
import type { Barberia } from "@/lib/barberia";

const MAX_GALERIA = 12;

export function BarberiaForm({ barberia }: { barberia: Barberia }) {
  const router = useRouter();
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoGaleria, setSubiendoGaleria] = useState(false);
  const [form, setForm] = useState({
    nombre: barberia.nombre,
    eslogan: barberia.eslogan ?? "",
    descripcion: barberia.descripcion ?? "",
    instagram: barberia.instagram ?? "",
    telefono: barberia.telefono ?? "",
    email_contacto: barberia.email_contacto ?? "",
    plazo_horas: String(barberia.plazo_cancelacion_min / 60),
  });
  const [logo, setLogo] = useState<string | null>(barberia.logo_url);
  const [logoOscuro, setLogoOscuro] = useState<string | null>(barberia.logo_oscuro_url);
  const [galeria, setGaleria] = useState<string[]>(barberia.galeria);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleGaleria = async (files: FileList | null) => {
    if (!files?.length) return;
    const disponibles = MAX_GALERIA - galeria.length;
    if (disponibles <= 0) {
      toast.error(`La galería admite hasta ${MAX_GALERIA} fotos`);
      return;
    }

    setSubiendoGaleria(true);
    const nuevas: string[] = [];
    for (const file of Array.from(files).slice(0, disponibles)) {
      try {
        nuevas.push(await subirImagen(barberia.id_barberia, "galeria", file));
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "no se pudo subir"}`);
      }
    }
    setGaleria((prev) => [...prev, ...nuevas]);
    setSubiendoGaleria(false);
    if (galeriaRef.current) galeriaRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    const plazoMin = Math.round(Number(form.plazo_horas) * 60);
    if (!Number.isFinite(plazoMin) || plazoMin < 0) {
      toast.error("El plazo para cancelar debe ser 0 o más horas");
      return;
    }

    setGuardando(true);
    const supabase = createClient();
    // RLS: solo el admin de la barbería puede actualizarla
    const { data, error } = await supabase
      .from("barberia")
      .update({
        nombre: form.nombre.trim(),
        eslogan: form.eslogan.trim() || null,
        descripcion: form.descripcion.trim() || null,
        instagram: form.instagram.trim() || null,
        telefono: form.telefono.trim() || null,
        email_contacto: form.email_contacto.trim().toLowerCase() || null,
        plazo_cancelacion_min: plazoMin,
        logo_url: logo,
        logo_oscuro_url: logoOscuro,
        galeria,
      })
      .eq("id_barberia", barberia.id_barberia)
      .select("id_barberia");
    setGuardando(false);

    if (error || !data?.length) {
      console.error("Error updating barbería:", error);
      toast.error("No se pudieron guardar los cambios");
      return;
    }

    toast.success("Cambios guardados");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
          <CardDescription>Aparece en la portada y en los correos a tus clientes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={form.nombre} onChange={set("nombre")} required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eslogan">Eslogan</Label>
              <Input id="eslogan" value={form.eslogan} onChange={set("eslogan")} maxLength={120} placeholder="Tu estilo, nuestra pasión." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Sobre nosotros</Label>
            <Textarea
              id="descripcion"
              value={form.descripcion}
              onChange={set("descripcion")}
              rows={5}
              maxLength={1500}
              placeholder="Cuenta la historia de tu barbería. Separa los párrafos con una línea en blanco."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" value={form.instagram} onChange={set("instagram")} placeholder="@tubarberia" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" value={form.telefono} onChange={set("telefono")} placeholder="+56 9 1234 5678" maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_contacto">Correo de contacto</Label>
              <Input id="email_contacto" type="email" value={form.email_contacto} onChange={set("email_contacto")} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plazo_horas">Plazo para cancelar o reprogramar (horas)</Label>
              <Input id="plazo_horas" type="number" min={0} step={0.5} value={form.plazo_horas} onChange={set("plazo_horas")} aria-describedby="plazo_ayuda" />
              <p id="plazo_ayuda" className="text-xs text-muted-foreground">Tus clientes pueden cancelar o cambiar la hora hasta este tiempo antes de la cita.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Si no subes un logo, se muestra el nombre de la barbería.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <ImagenInput
            label="Logo"
            descripcion="Para fondo claro (también se usa en modo oscuro si no hay otra versión)."
            value={logo}
            onChange={setLogo}
            idBarberia={barberia.id_barberia}
            fondo="claro"
          />
          <ImagenInput
            label="Logo para modo oscuro"
            descripcion="Opcional: versión clara del logo para fondo oscuro."
            value={logoOscuro}
            onChange={setLogoOscuro}
            idBarberia={barberia.id_barberia}
            fondo="oscuro"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Galería de trabajos</CardTitle>
          <CardDescription>Fotos de tus cortes para la sección &quot;Trabajos Recientes&quot; (hasta {MAX_GALERIA}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {galeria.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {galeria.map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border group">
                  <img src={url} alt="Trabajo" className="h-full w-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-90"
                    onClick={() => setGaleria(galeria.filter((g) => g !== url))}
                    aria-label="Quitar foto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={galeriaRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleGaleria(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => galeriaRef.current?.click()}
            disabled={subiendoGaleria || galeria.length >= MAX_GALERIA}
          >
            {subiendoGaleria ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
            Agregar fotos
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={guardando || subiendoGaleria} className="min-w-40">
          {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
