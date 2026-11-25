"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { rutaImagen, type CarpetaImagen } from "@/lib/imagenes";

const MAX_IMAGEN_MB = 5;

/** Sube una imagen a la carpeta de la barbería (Storage solo deja escribir a su admin). */
export async function subirImagen(idBarberia: string, carpeta: CarpetaImagen, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > MAX_IMAGEN_MB * 1024 * 1024) throw new Error(`La imagen no puede pesar más de ${MAX_IMAGEN_MB} MB`);

  const supabase = createClient();
  const path = rutaImagen(idBarberia, carpeta, file.name);

  const { error } = await supabase.storage.from("imgs").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("imgs").getPublicUrl(path).data.publicUrl;
}

export function ImagenInput({
  carpeta = "logo",
  vacio = "Sin logo",
  label,
  descripcion,
  value,
  onChange,
  idBarberia,
  fondo,
}: {
  carpeta?: CarpetaImagen;
  /** Texto mientras no hay imagen. */
  vacio?: string;
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
      onChange(await subirImagen(idBarberia, carpeta, file));
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
          <span className={`text-xs ${fondo === "claro" ? "text-zinc-500" : "text-zinc-400"}`}>{vacio}</span>
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
