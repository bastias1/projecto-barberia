import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverAcceso } from "../lib/acceso";

// Destinos tras el login (lib/acceso.ts). Sin Supabase: un cliente falso devuelve la fila de `usuario`.
type Fila = { rol: string; usuario_barberia: { rol: string; activo: boolean; barberia: { slug: string; nombre: string; activa: boolean } | null }[] };

const m = (slug: string, rol = "admin", extra: { activo?: boolean; activa?: boolean } = {}) =>
  ({ rol, activo: extra.activo ?? true, barberia: { slug, nombre: slug.toUpperCase(), activa: extra.activa ?? true } });
const fila = (membresias: Fila["usuario_barberia"] = [], rol = "usuario"): Fila => ({ rol, usuario_barberia: membresias });

function cliente(resultado: { data: Fila | null; error?: { message: string } | null }) {
  const cadena = { select: () => cadena, eq: () => cadena, maybeSingle: async () => ({ data: resultado.data, error: resultado.error ?? null }) };
  return { from: () => cadena } as unknown as SupabaseClient;
}
const destino = async (f: Fila | null, ctx = {}) => (await resolverAcceso(cliente({ data: f }), "u1", ctx)).destino;

describe("resolverAcceso · destino", () => {
  it("?next= interno gana sobre todo", async () => {
    expect(await destino(fila([m("a")]), { next: "/benjvmin/checkout", barberia: "a" })).toBe("/benjvmin/checkout");
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", ""])("?next= no interno se ignora: %s", async (next) => {
    expect(await destino(fila([m("a")]), { next })).toBe("/a/dashboard");
  });

  it("con barbería de origen: su personal va al dashboard, el resto a su página", async () => {
    expect(await destino(fila([m("a", "profesional")]), { barberia: "a" })).toBe("/a/dashboard");
    expect(await destino(fila([m("a", "cliente")]), { barberia: "a" })).toBe("/a");
    expect(await destino(fila([m("b")]), { barberia: "a" })).toBe("/a"); // nunca al dashboard de otra
  });

  it("superadmin sin membresía en la barbería de origen va a su página", async () => {
    expect(await destino(fila([], "superadmin"), { barberia: "a" })).toBe("/a");
  });

  it("sin contexto: superadmin a /admin aunque trabaje en una barbería", async () => {
    expect(await destino(fila([m("a")], "superadmin"))).toBe("/admin");
  });

  it("sin contexto: personal de una sola barbería a su dashboard", async () => {
    expect(await destino(fila([m("a", "profesional"), m("b", "cliente")]))).toBe("/a/dashboard");
  });

  it("sin contexto: personal de varias barberías, solo cliente o sin nada → /cuenta", async () => {
    expect(await destino(fila([m("a"), m("b")]))).toBe("/cuenta");
    expect(await destino(fila([m("a", "cliente")]))).toBe("/cuenta");
    expect(await destino(fila())).toBe("/cuenta");
  });
});

describe("resolverAcceso · membresías", () => {
  it("descarta membresías inactivas y barberías inactivas", async () => {
    const r = await resolverAcceso(cliente({ data: fila([m("a"), m("b", "admin", { activo: false }), m("c", "admin", { activa: false })]) }), "u1");
    expect(r.membresias).toEqual([{ slug: "a", nombre: "A", rol: "admin" }]);
  });

  it("esSuperadmin refleja usuario.rol", async () => {
    expect((await resolverAcceso(cliente({ data: fila([], "superadmin") }), "u1")).esSuperadmin).toBe(true);
    expect((await resolverAcceso(cliente({ data: fila() }), "u1")).esSuperadmin).toBe(false);
  });

  it("si la consulta falla: registra el error y cae a /cuenta sin membresías", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await resolverAcceso(cliente({ data: null, error: { message: "boom" } }), "u1");
    expect(r).toEqual({ esSuperadmin: false, membresias: [], destino: "/cuenta" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
