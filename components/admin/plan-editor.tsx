"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { guardarPlan } from "@/app/admin/actions";
import type { Plan } from "@/lib/planes";

const MODULOS_OPCIONALES = [
  { codigo: "ecommerce", label: "Tienda en línea" },
  { codigo: "bi", label: "Estadísticas (BI)" },
];

const LIMITES = [
  { codigo: "max_sucursales", label: "Sucursales" },
  { codigo: "max_profesionales", label: "Barberos" },
  { codigo: "max_productos", label: "Productos" },
];

/** Crear o editar un plan: precio, módulos y límites (vacío = sin límite). */
export function PlanEditor({ plan }: { plan: Plan | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const inicial = () => ({
    nombre: plan?.nombre ?? "",
    descripcion: plan?.descripcion ?? "",
    precio: plan ? String(plan.precio_mensual) : "",
    activo: plan?.activo ?? true,
    modulos: plan?.modulos ?? [],
    limites: Object.fromEntries(LIMITES.map((l) => [l.codigo, plan?.limites[l.codigo] ?? null])) as Record<string, number | null>,
  });
  const [form, setForm] = useState(inicial);

  const handleOpen = (v: boolean) => {
    if (v) setForm(inicial());
    setOpen(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await guardarPlan({
        idPlan: plan?.id_plan ?? null,
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: Number(form.precio),
        activo: form.activo,
        modulos: form.modulos,
        limites: form.limites,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(plan ? "Plan actualizado" : "Plan creado");
      setOpen(false);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="outline" size="sm" className="gap-1"><Pencil className="h-3.5 w-3.5" />Editar</Button>
        ) : (
          <Button className="gap-2"><Plus className="h-4 w-4" />Nuevo plan</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{plan ? `Editar ${plan.nombre}` : "Nuevo plan"}</DialogTitle>
            <DialogDescription>
              El precio nuevo aplica a nuevas suscripciones; las que ya pagan mantienen su precio pactado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-nombre">Nombre</Label>
              <Input id="plan-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={40} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-precio">Precio mensual (CLP)</Label>
              <Input id="plan-precio" type="number" min={0} step={10} value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-desc">Descripción</Label>
            <Textarea id="plan-desc" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label>Módulos</Label>
            <p className="text-xs text-muted-foreground">La agenda está incluida en todos los planes.</p>
            <div className="flex flex-wrap gap-4">
              {MODULOS_OPCIONALES.map((m) => (
                <label key={m.codigo} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.modulos.includes(m.codigo)}
                    onCheckedChange={(v) =>
                      setForm({ ...form, modulos: v ? [...form.modulos, m.codigo] : form.modulos.filter((c) => c !== m.codigo) })
                    }
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Límites</Label>
            <p className="text-xs text-muted-foreground">Déjalo vacío para que sea sin límite.</p>
            <div className="grid grid-cols-3 gap-3">
              {LIMITES.map((l) => (
                <div key={l.codigo} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="∞"
                    value={form.limites[l.codigo] ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, limites: { ...form.limites, [l.codigo]: e.target.value === "" ? null : Number(e.target.value) } })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span>
              <span className="font-medium">Disponible para nuevas barberías</span>
              <span className="block text-xs text-muted-foreground">Si lo desactivas, deja de mostrarse en la portada y en Suscripción.</span>
            </span>
            <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
