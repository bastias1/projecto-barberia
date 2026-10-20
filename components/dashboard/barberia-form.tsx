"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import type { Barberia } from "@/lib/barberia";

const MAX_GALERIA = 12;
const MAX_IMAGEN_MB = 5;

/** Sube una imagen a la carpeta de la barbería (Storage solo deja escribir a su admin). */
async function subirImagen(idBarberia: string, carpeta: "logo" | "galeria", file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > MAX_IMAGEN_MB * 1024 * 1024) throw new Error(`La imagen no puede pesar más de ${MAX_IMAGEN_MB} MB`);

  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `barberias/${idBarberia}/${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from("imgs").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("imgs").getPublicUrl(path).data.publicUrl;
}

function LogoInput({
  label,
  descripcion,
  value,
  onChange,
  idBarberia,
  fondo,
}: {
  label: string;
  descripcion: string;
  value: string | null;
  onChange: (url: string | null) => void;
  idBarberia: string;
  fondo: "claro" | "oscuro";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setSubiendo(true);
    try {
      onChange(await subirImagen(idBarberia, "logo", file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className={`h-28 rounded-lg border flex items-center justify-center p-3 ${fondo === "claro" ? "bg-white" : "bg-zinc-950"}`}>
        {value ? (
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={`text-xs ${fondo === "claro" ? "text-zinc-400" : "text-zinc-500"}`}>Sin logo</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{descripcion}</p>
      <div className="flex gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={subiendo}>
          {subiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Subir
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={subiendo}>
            Quitar
          </Button>
        )}
      </div>
    </div>
  );
}

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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Si no subes un logo, se muestra el nombre de la barbería.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <LogoInput
            label="Logo"
            descripcion="Para fondo claro (también se usa en modo oscuro si no hay otra versión)."
            value={logo}
            onChange={setLogo}
            idBarberia={barberia.id_barberia}
            fondo="claro"
          />
          <LogoInput
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
