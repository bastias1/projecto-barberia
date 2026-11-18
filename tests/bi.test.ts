import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, ok } from "./helpers/supabase";
import { borrarBarberia, fecha, sembrarBarberiaBI } from "./helpers/semilla-bi";

// HU-13 / HU-16 · CP-04, CP-29, CP-50 (Requerimientos.md §11)
let s: Awaited<ReturnType<typeof sembrarBarberiaBI>>;

beforeAll(async () => { s = await sembrarBarberiaBI(); });
afterAll(async () => { if (s) await borrarBarberia(s.idBarberia); });

const rango = () => ({ p_barberia: s.idBarberia, p_desde: fecha(182), p_hasta: fecha(0) });
const FUNCIONES_BI = ["bi_ingresos", "bi_servicios", "bi_productos", "bi_demanda", "bi_ocupacion", "bi_resumen_mensual"];

/** Lo mismo que pide la página "Estadísticas del negocio" al cargar (estadisticas-vista.tsx). */
async function cargarDashboard(db: SupabaseClient) {
  const r = rango();
  const resultados = await Promise.all([
    db.rpc("bi_ingresos", { ...r, p_gran: "month" }),
    db.rpc("bi_servicios", r), db.rpc("bi_productos", r), db.rpc("bi_demanda", r),
    db.rpc("bi_ocupacion", r), db.rpc("bi_resumen_mensual", r),
    db.from("sucursal").select("id:id_sucursal, nombre").eq("id_barberia", s.idBarberia),
    db.rpc("profesionales_publicos", { p_barberia: s.idBarberia }),
    db.from("servicio").select("id:id_servicio, nombre").eq("id_barberia", s.idBarberia),
  ]);
  return resultados.map((x) => ok(x));
}

describe("CP-04 · dashboard mensual sobre 6 meses < 5 s (p95)", () => {
  it("carga con datos y p95 bajo 5000 ms", async () => {
    const [ingresos] = (await cargarDashboard(s.adm.db)) as { servicios: number; productos: number }[][];
    expect(ingresos.reduce((t, m) => t + Number(m.servicios), 0)).toBeGreaterThan(0);
    expect(ingresos.reduce((t, m) => t + Number(m.productos), 0)).toBeGreaterThan(0);

    const tiempos: number[] = [];
    for (let k = 0; k < 20; k++) {
      const t0 = performance.now();
      await cargarDashboard(s.adm.db);
      tiempos.push(performance.now() - t0);
    }
    tiempos.sort((a, b) => a - b);
    const p95 = tiempos[Math.ceil(0.95 * tiempos.length) - 1];
    console.log(`[CP-04] ${s.reservas} reservas · p50 ${Math.round(tiempos[9])} ms · p95 ${Math.round(p95)} ms`);
    expect(p95).toBeLessThan(5000);
  });
});

describe("CP-29 · sin el módulo bi no hay estadísticas", () => {
  it("el admin de un plan sin bi recibe insufficient_privilege en cada función", async () => {
    ok(await admin.from("suscripcion").update({ id_plan: s.planSinBi }).eq("id_barberia", s.idBarberia));
    try {
      for (const fn of FUNCIONES_BI) {
        const { error } = await s.adm.db.rpc(fn, rango());
        expect(error?.code, fn).toBe("42501");
      }
    } finally {
      ok(await admin.from("suscripcion").update({ id_plan: s.planConBi }).eq("id_barberia", s.idBarberia));
    }
  });

  it("un cliente de la barbería no recibe estadísticas", async () => {
    const { error } = await s.cliente.db.rpc("bi_ingresos", rango());
    expect(error?.code).toBe("42501");
  });

  it("un barbero solo ve sus citas y nunca pedidos, aunque pida las de otro", async () => {
    const filas = ok(await s.barbero.db.rpc("bi_reservas", { ...rango(), p_profesional: s.adm.id })) as { id_profesional: string }[];
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.id_profesional === s.barbero.id)).toBe(true);
    expect(ok(await s.barbero.db.rpc("bi_pedidos_pagados", rango()))).toEqual([]);
  });
});

describe("CP-50 · bi no se contrata como adicional", () => {
  it("rechaza un suscripcion_modulo activo de bi, incluso al superadmin", async () => {
    const { error } = await s.superadmin.db.from("suscripcion_modulo")
      .insert({ id_barberia: s.idBarberia, id_modulo: s.idModuloBi, precio_pactado: 1000 });
    expect(error?.code).toBe("23514");
  });

  it("permite registrarlo como cancelado (la regla es solo para adicionales vigentes)", async () => {
    ok(await s.superadmin.db.from("suscripcion_modulo")
      .insert({ id_barberia: s.idBarberia, id_modulo: s.idModuloBi, precio_pactado: 1000, estado: "cancelado" }));
  });
});
