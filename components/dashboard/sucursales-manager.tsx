"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/utils/supabase/client";
import { useBarberia } from "@/components/barberia-provider";
import { slugify } from "@/lib/utils";

export interface SucursalAdmin {
  id_sucursal: number;
  slug: string;
  nombre: string;
  direccion: string;
  comuna: string;
  region: string | null;
  telefono: string | null;
  activa: boolean;
}

export interface BarberoAdmin {
  id: string;
  nombre: string;
  profile_image: string | null;
}

export interface Asignacion {
  id_profesional: string;
  id_sucursal: number;
}

const FORM_VACIO = { nombre: "", slug: "", direccion: "", comuna: "", region: "", telefono: "" };

/** Mensajes de la base (límite del plan, slug repetido o reservado) en español. */
function mensajeError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "23505") {
    return error.message?.includes("slug")
      ? "Ya existe una sucursal con esa dirección web"
      : "Ya existe una sucursal con ese nombre";
  }
  if (error.code === "23514") {
    if (error.message?.includes("slug")) return "Esa dirección web no está disponible";
    return error.message || fallback; // p. ej. límite de sucursales del plan
  }
  return fallback;
}

export function SucursalesManager({
  sucursales: iniciales,
  barberos,
  asignaciones: asignacionesIniciales,
}: {
  sucursales: SucursalAdmin[];
  barberos: BarberoAdmin[];
  asignaciones: Asignacion[];
}) {
  const router = useRouter();
  const barberia = useBarberia();
  const [sucursales, setSucursales] = useState(iniciales);
  const [asignaciones, setAsignaciones] = useState(asignacionesIniciales);
  const [editando, setEditando] = useState<SucursalAdmin | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [slugEditado, setSlugEditado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null); // "<idSucursal>:<idBarbero>" en curso
  const [quitar, setQuitar] = useState<{ sucursal: SucursalAdmin; barbero: BarberoAdmin } | null>(null);

  const asignado = (idSucursal: number, idBarbero: string) =>
    asignaciones.some((a) => a.id_sucursal === idSucursal && a.id_profesional === idBarbero);

  const abrirNueva = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setSlugEditado(false);
    setDialogOpen(true);
  };

  const abrirEditar = (s: SucursalAdmin) => {
    setEditando(s);
    setForm({
      nombre: s.nombre,
      slug: s.slug,
      direccion: s.direccion,
      comuna: s.comuna,
      region: s.region ?? "",
      telefono: s.telefono ?? "",
    });
    setSlugEditado(true); // la URL de una sucursal existente no cambia sola
    setDialogOpen(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.direccion.trim() || !form.comuna.trim()) {
      toast.error("Completa el nombre, la dirección y la comuna");
      return;
    }

    setGuardando(true);
    const supabase = createClient();
    const datos = {
      nombre: form.nombre.trim(),
      // Vacío: la base genera el slug desde el nombre
      slug: form.slug.trim() || null,
      direccion: form.direccion.trim(),
      comuna: form.comuna.trim(),
      region: form.region.trim() || null,
      telefono: form.telefono.trim() || null,
    };
    const columnas = "id_sucursal, slug, nombre, direccion, comuna, region, telefono, activa";

    const { data, error } = editando
      ? await supabase.from("sucursal").update(datos).eq("id_sucursal", editando.id_sucursal).select(columnas).single()
      : await supabase.from("sucursal").insert({ ...datos, id_barberia: barberia.id_barberia }).select(columnas).single();
    setGuardando(false);

    if (error || !data) {
      console.error("Error saving sucursal:", error);
      toast.error(mensajeError(error ?? {}, "No se pudo guardar la sucursal"));
      return;
    }

    setSucursales(editando
      ? sucursales.map((s) => (s.id_sucursal === data.id_sucursal ? data : s))
      : [...sucursales, data]);
    setDialogOpen(false);
    toast.success(editando ? "Sucursal actualizada" : "Sucursal creada");
    router.refresh();
  };

  const toggleActiva = async (s: SucursalAdmin, activa: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.from("sucursal").update({ activa }).eq("id_sucursal", s.id_sucursal);
    if (error) {
      console.error("Error toggling sucursal:", error);
      toast.error(mensajeError(error, "No se pudo cambiar el estado de la sucursal"));
      return;
    }
    setSucursales(sucursales.map((x) => (x.id_sucursal === s.id_sucursal ? { ...x, activa } : x)));
    toast.success(activa ? `${s.nombre} está activa` : `${s.nombre} ya no recibe reservas`);
    router.refresh();
  };

  const asignar = async (s: SucursalAdmin, b: BarberoAdmin) => {
    setPendiente(`${s.id_sucursal}:${b.id}`);
    const { error } = await createClient()
      .from("profesional_sucursal")
      .insert({ id_barberia: barberia.id_barberia, id_profesional: b.id, id_sucursal: s.id_sucursal });
    setPendiente(null);
    if (error && error.code !== "23505") {
      console.error("Error assigning barber:", error);
      toast.error("No se pudo asignar al barbero");
      return;
    }
    setAsignaciones([...asignaciones, { id_profesional: b.id, id_sucursal: s.id_sucursal }]);
    toast.success(`${b.nombre} atiende en ${s.nombre}`);
  };

  // Al quitarlo, la base desactiva sus horarios en esa sucursal
  const confirmarQuitar = async () => {
    if (!quitar) return;
    const { sucursal: s, barbero: b } = quitar;
    setQuitar(null);
    setPendiente(`${s.id_sucursal}:${b.id}`);
    const { error } = await createClient()
      .from("profesional_sucursal")
      .delete()
      .eq("id_barberia", barberia.id_barberia)
      .eq("id_profesional", b.id)
      .eq("id_sucursal", s.id_sucursal);
    setPendiente(null);
    if (error) {
      console.error("Error unassigning barber:", error);
      toast.error("No se pudo quitar al barbero");
      return;
    }
    setAsignaciones(asignaciones.filter((a) => !(a.id_sucursal === s.id_sucursal && a.id_profesional === b.id)));
    toast.success(`${b.nombre} ya no atiende en ${s.nombre}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Sucursales</CardTitle>
          <CardDescription>
            Cada sucursal tiene su página y su agenda. Asigna los barberos que atienden en cada una:
            al reservar ahí solo se muestran ellos y sus servicios.
          </CardDescription>
        </div>
        <Button type="button" onClick={abrirNueva} className="gap-2 flex-shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva sucursal</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {sucursales.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no tienes sucursales.</p>
        )}

        {sucursales.map((s) => (
          <div key={s.id_sucursal} className={`rounded-lg border p-4 space-y-4 ${s.activa ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{s.nombre}</h3>
                    {!s.activa && <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {s.direccion}, {s.comuna}{s.region ? `, ${s.region}` : ""}
                  </p>
                  {s.activa && (
                    <a
                      href={`/${barberia.slug}/${s.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground"
                    >
                      /{barberia.slug}/{s.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`activa-${s.id_sucursal}`}
                    checked={s.activa}
                    onCheckedChange={(v) => toggleActiva(s, v)}
                  />
                  <Label htmlFor={`activa-${s.id_sucursal}`} className="text-sm">Activa</Label>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => abrirEditar(s)} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Barberos que atienden aquí</p>
              {barberos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Crea barberos en Usuarios para asignarlos.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {barberos.map((b) => {
                    const marcado = asignado(s.id_sucursal, b.id);
                    const enCurso = pendiente === `${s.id_sucursal}:${b.id}`;
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        {enCurso ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Checkbox
                            checked={marcado}
                            disabled={pendiente !== null}
                            onCheckedChange={(v) => (v ? asignar(s, b) : setQuitar({ sucursal: s, barbero: b }))}
                          />
                        )}
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={b.profile_image || undefined} alt={b.nombre} />
                          <AvatarFallback className="text-[10px]">{b.nombre.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{b.nombre}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      {/* Crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleGuardar} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editando ? `Editar ${editando.nombre}` : "Nueva sucursal"}</DialogTitle>
              <DialogDescription>La dirección se muestra en su página con un mapa.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="suc-nombre">Nombre</Label>
              <Input
                id="suc-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value, slug: slugEditado ? form.slug : slugify(e.target.value) })}
                placeholder="Centro"
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suc-slug">Dirección web</Label>
              <div className="flex items-center rounded-md border border-input bg-background h-9 overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 pr-1 text-sm text-muted-foreground whitespace-nowrap">/{barberia.slug}/</span>
                <input
                  id="suc-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEditado(true);
                    setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                  }}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="Letras minúsculas, números y guiones"
                  maxLength={40}
                  placeholder="centro"
                  className="flex-1 min-w-0 h-full bg-transparent pr-3 text-sm outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suc-direccion">Dirección</Label>
              <Input
                id="suc-direccion"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Av. Ramón Picarte 1234"
                maxLength={120}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suc-comuna">Comuna</Label>
                <Input id="suc-comuna" value={form.comuna} onChange={(e) => setForm({ ...form, comuna: e.target.value })} maxLength={60} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suc-region">Región</Label>
                <Input id="suc-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Los Ríos" maxLength={60} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suc-telefono">Teléfono (opcional)</Label>
              <Input id="suc-telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+56 9 1234 5678" maxLength={30} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editando ? "Guardar" : "Crear sucursal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar quitar barbero */}
      <AlertDialog open={quitar !== null} onOpenChange={(open) => !open && setQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {quitar?.barbero.nombre} de {quitar?.sucursal.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivarán sus horarios en esta sucursal y ya no se podrá reservar con él ahí.
              Las reservas que ya tiene se mantienen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarQuitar}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
