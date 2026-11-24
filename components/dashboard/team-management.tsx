"use client"

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Copy, Edit, Loader2, Mail, RotateCw, Send, UserMinus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { ROL_LABEL, tieneAgenda } from "@/lib/roles";
import { useBarberia } from "@/components/barberia-provider";
import { cancelarInvitacion, invitarMiembro, reenviarInvitacion } from "@/app/[slug]/dashboard/usuarios/actions";

export interface Miembro {
  id: string;
  nombre: string;
  correo: string;
  profile_image: string | null;
  rol: "admin" | "profesional";
  especialidad: string | null;
  /** Tiene ficha de barbero activa (agenda): un admin puede atender además de administrar. */
  atiende: boolean;
}

export interface Invitacion {
  id_invitacion: number;
  correo: string;
  rol: "admin" | "profesional";
  token: string;
  expira_at: string;
  created_at: string;
}

interface TeamManagementProps {
  currentUserId: string;
  miembros: Miembro[];
  invitaciones: Invitacion[];
  suscripcionVigente: boolean;
  cupoBarberos: { usados: number; maximo: number | null }; // maximo null = sin límite
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });

/** Equipo de la barbería: invitaciones por correo y gestión de roles. */
export function TeamManagement({ currentUserId, miembros, invitaciones, suscripcionVigente, cupoBarberos }: TeamManagementProps) {
  const router = useRouter();
  const barberia = useBarberia();
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<"profesional" | "admin">("profesional");
  const [invitando, setInvitando] = useState(false);
  const [pendiente, setPendiente] = useState<number | null>(null);
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [formEdicion, setFormEdicion] = useState({ rol: "profesional", especialidad: "", atiende: false });
  const [guardando, setGuardando] = useState(false);
  const [quitar, setQuitar] = useState<Miembro | null>(null);

  // Invitaciones pendientes de barbero también ocupan cupo
  const invitacionesBarbero = invitaciones.filter((i) => i.rol === "profesional" && new Date(i.expira_at) > new Date()).length;
  const sinCupo = rol === "profesional" && cupoBarberos.maximo !== null && cupoBarberos.usados + invitacionesBarbero >= cupoBarberos.maximo;

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvitando(true);
    const result = await invitarMiembro({ slug: barberia.slug, correo, rol });
    setInvitando(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.correoEnviado === false) {
      toast.warning("La invitación se creó, pero el correo no salió. Usa \"Copiar link\" y envíaselo tú.");
    } else {
      toast.success(`Invitación enviada a ${correo.trim().toLowerCase()}`);
    }
    setCorreo("");
    router.refresh();
  };

  const accionInvitacion = async (inv: Invitacion, accion: "reenviar" | "cancelar") => {
    setPendiente(inv.id_invitacion);
    const fn = accion === "reenviar" ? reenviarInvitacion : cancelarInvitacion;
    const result = await fn({ slug: barberia.slug, idInvitacion: inv.id_invitacion });
    setPendiente(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (accion === "reenviar" && "correoEnviado" in result && result.correoEnviado === false) {
      toast.warning("La invitación se renovó, pero el correo no salió. Usa \"Copiar link\".");
    } else {
      toast.success(accion === "reenviar" ? `Invitación reenviada a ${inv.correo}` : "Invitación cancelada");
    }
    router.refresh();
  };

  // Respaldo por si el correo no llega: el link también se puede enviar por WhatsApp, etc.
  const copiarLink = async (inv: Invitacion) => {
    const link = `${window.location.origin}/invitacion/${inv.token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de invitación copiado");
    } catch {
      toast.info(link);
    }
  };

  const abrirEdicion = (m: Miembro) => {
    setEditando(m);
    setFormEdicion({ rol: m.rol, especialidad: m.especialidad ?? "", atiende: m.atiende });
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setGuardando(true);
    try {
      const response = await fetch(`/api/admin/update-user?barberia=${barberia.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editando.id, rol: formEdicion.rol, especialidad: formEdicion.especialidad, atiende: formEdicion.atiende }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "No se pudo actualizar");
        return;
      }
      toast.success("Miembro actualizado");
      setEditando(null);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  // Lo quita de la barbería; su cuenta y su historial se conservan
  const confirmarQuitar = async () => {
    if (!quitar) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("usuario_barberia")
      .update({ activo: false })
      .eq("id_barberia", barberia.id_barberia)
      .eq("id_usuario", quitar.id);
    if (!error) {
      await supabase
        .from("profesional")
        .update({ activo: false })
        .eq("id_barberia", barberia.id_barberia)
        .eq("id_profesional", quitar.id);
    }
    if (error) {
      console.error("Error removing member:", error);
      toast.error("No se pudo quitar del equipo");
    } else {
      toast.success(`${quitar.nombre} ya no es parte del equipo`);
      router.refresh();
    }
    setQuitar(null);
  };

  return (
    <div className="space-y-6">
      {/* Invitar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Invitar al equipo</CardTitle>
          <CardDescription>
            Le llegará un correo para aceptar o rechazar. Si aún no tiene cuenta, podrá crearla gratis con ese correo.
            {cupoBarberos.maximo !== null && (
              <> Barberos: <strong>{cupoBarberos.usados} de {cupoBarberos.maximo}</strong>{invitacionesBarbero > 0 && ` (+${invitacionesBarbero} invitados)`}.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!suscripcionVigente ? (
            <p className="text-sm text-muted-foreground">
              Necesitas una suscripción vigente para invitar a tu equipo.{" "}
              <Link href={`/${barberia.slug}/dashboard/suscripcion`} className="font-medium text-foreground underline underline-offset-4">
                Ver suscripción
              </Link>
            </p>
          ) : (
            <form onSubmit={handleInvitar} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                maxLength={120}
                className="sm:flex-1"
              />
              <Select value={rol} onValueChange={(v) => setRol(v as "profesional" | "admin")}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profesional">Barbero</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={invitando || sinCupo} className="gap-2">
                {invitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Invitar
              </Button>
            </form>
          )}
          {suscripcionVigente && sinCupo && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              Llegaste al máximo de barberos de tu plan.{" "}
              <Link href={`/${barberia.slug}/dashboard/suscripcion`} className="underline underline-offset-4">Cambia de plan</Link> para invitar más.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invitaciones pendientes */}
      {invitaciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitaciones.map((inv) => {
              const vencida = new Date(inv.expira_at) < new Date();
              const enCurso = pendiente === inv.id_invitacion;
              return (
                <div key={inv.id_invitacion} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{inv.correo}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ROL_LABEL[inv.rol]} · {vencida ? "Vencida" : `Vence el ${fechaCorta(inv.expira_at)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copiarLink(inv)} className="gap-1">
                      <Copy className="h-3.5 w-3.5" />
                      Copiar link
                    </Button>
                    <Button size="sm" variant="outline" disabled={enCurso} onClick={() => accionInvitacion(inv, "reenviar")} className="gap-1">
                      {enCurso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                      Reenviar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={enCurso} onClick={() => accionInvitacion(inv, "cancelar")} className="gap-1 text-red-600">
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Miembros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Miembros ({miembros.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {miembros.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.profile_image || undefined} alt={m.nombre} />
                  <AvatarFallback>{m.nombre.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {m.nombre} {m.id === currentUserId && <span className="text-xs text-muted-foreground">(tú)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.correo}{m.especialidad ? ` · ${m.especialidad}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.rol === "admin" ? "default" : "secondary"}>{ROL_LABEL[m.rol]}</Badge>
                {m.rol === "admin" && m.atiende &&<Badge variant="secondary">{ROL_LABEL.profesional}</Badge>}
                <Button size="icon" variant="ghost" onClick={() => abrirEdicion(m)} aria-label={`Editar a ${m.nombre}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                {m.id !== currentUserId && (
                  <Button size="icon" variant="ghost" className="text-red-600" onClick={() => setQuitar(m)} aria-label={`Quitar a ${m.nombre}`}>
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editar rol y especialidad */}
      <Dialog open={editando !== null} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <form onSubmit={handleGuardarEdicion} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Editar a {editando?.nombre}</DialogTitle>
              <DialogDescription>Sus datos personales los administra desde su propia cuenta.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={formEdicion.rol}
                onValueChange={(v) => setFormEdicion({ ...formEdicion, rol: v })}
                disabled={editando?.id === currentUserId}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profesional">Barbero</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {editando?.id === currentUserId && <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>}
            </div>
            {formEdicion.rol === "admin" && (
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span>
                  <span className="font-medium">También atiende clientes</span>
                  <span className="block text-xs text-muted-foreground">Tiene agenda propia y aparece al reservar. Cuenta para el máximo de barberos de tu plan.</span>
                </span>
                <Switch checked={formEdicion.atiende} onCheckedChange={(v) => setFormEdicion({ ...formEdicion, atiende: v })} />
              </label>
            )}
            {tieneAgenda(formEdicion.rol as Miembro["rol"], formEdicion.atiende) && (
              <div className="space-y-2">
                <Label htmlFor="especialidad">Especialidad</Label>
                <Input
                  id="especialidad"
                  value={formEdicion.especialidad}
                  onChange={(e) => setFormEdicion({ ...formEdicion, especialidad: e.target.value })}
                  placeholder="Fade, barba, cortes clásicos…"
                  maxLength={80}
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quitar del equipo */}
      <AlertDialog open={quitar !== null} onOpenChange={(open) => !open && setQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {quitar?.nombre} del equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de tener acceso al dashboard y de aparecer al reservar. Su cuenta y el historial de citas se conservan,
              y puedes volver a invitarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarQuitar}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
