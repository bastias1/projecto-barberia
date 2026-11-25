export type CarpetaImagen = "logo" | "galeria" | "portada";

/** Ruta en el bucket `imgs`. leerApariencia solo acepta portadas con esta forma. */
export function rutaImagen(idBarberia: string, carpeta: CarpetaImagen, archivo: string): string {
  const ext = archivo.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? "png";
  return `barberias/${idBarberia}/${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
