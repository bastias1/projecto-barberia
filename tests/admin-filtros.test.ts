import { describe, expect, it } from "vitest";
import type { FilaBarberia } from "../lib/admin-datos";
import { filtrarBarberias } from "../lib/admin-filtros";

// Filtros de /admin/barberias (lib/admin-filtros.ts). Sin Supabase.
const fila = (nombre: string, extra: Partial<FilaBarberia> = {}): FilaBarberia => ({
  id_barberia: nombre,
  nombre,
  slug: nombre.toLowerCase(),
  activa: true,
  created_at: "2026-01-01",
  suscripcion: null,
  plan: null,
  estado: { clave: "sin", label: "", tono: "outline" },
  duenos: [],
  barberos: 0,
  reservasMes: 0,
  ...extra,
});
const sus = (fecha_termino: string | null) => ({ id_suscripcion: 1, id_plan: 1, estado: "activa", fecha_termino, precio_pactado: 0, id_suscripcion_externa: null });

const a = fila("Alfa", { plan: "Pro", estado: { clave: "prueba", label: "", tono: "secondary" }, suscripcion: sus("2026-12-10"), reservasMes: 5 });
const b = fila("Beta", { plan: "Base", estado: { clave: "activa_mp", label: "", tono: "default" }, suscripcion: sus("2026-12-01"), reservasMes: 9 });
const c = fila("Gama", { duenos: [{ nombre: "X", email: "dueno@gama.cl" }] });
const todas = [a, b, c];
const nombres = (f: FilaBarberia[]) => f.map((x) => x.nombre);

describe("filtrarBarberias", () => {
  it("sin parámetros devuelve todo en el orden recibido", () => {
    expect(nombres(filtrarBarberias(todas, {}))).toEqual(["Alfa", "Beta", "Gama"]);
  });
  it("estado agrupa claves y admite varios", () => {
    expect(nombres(filtrarBarberias(todas, { estado: "activa" }))).toEqual(["Alfa", "Beta"]);
    expect(nombres(filtrarBarberias(todas, { estado: "vencida" }))).toEqual(["Gama"]);
    expect(nombres(filtrarBarberias(todas, { estado: "activa,vencida" }))).toHaveLength(3);
    expect(nombres(filtrarBarberias(todas, { estado: "suspendida" }, { sinEstado: true }))).toHaveLength(3);
  });
  it("plan y texto (también correo del dueño)", () => {
    expect(nombres(filtrarBarberias(todas, { plan: "Pro" }))).toEqual(["Alfa"]);
    expect(nombres(filtrarBarberias(todas, { q: "GAMA.cl" }))).toEqual(["Gama"]);
  });
  it("rango de vencimiento deja fuera las que no vencen", () => {
    expect(nombres(filtrarBarberias(todas, { desde: "2026-12-05" }))).toEqual(["Alfa"]);
    expect(nombres(filtrarBarberias(todas, { hasta: "2026-12-05" }))).toEqual(["Beta"]);
  });
  it("orden con vacíos al final en ambos sentidos", () => {
    expect(nombres(filtrarBarberias(todas, { orden: "vence" }))).toEqual(["Beta", "Alfa", "Gama"]);
    expect(nombres(filtrarBarberias(todas, { orden: "vence", dir: "desc" }))).toEqual(["Alfa", "Beta", "Gama"]);
    expect(nombres(filtrarBarberias(todas, { orden: "reservas", dir: "desc" }))).toEqual(["Beta", "Alfa", "Gama"]);
  });
});
