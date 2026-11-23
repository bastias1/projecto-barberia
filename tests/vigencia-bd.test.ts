import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib/notifications", () => ({ notificarSuscripcion: vi.fn() }));
vi.mock("../lib/pagos", () => ({ mercadoPagoClient: vi.fn(), registrarPagoCobro: vi.fn() }));

import { addDays, todayIn } from "../lib/datetime";
import { estadoSuscripcion } from "../lib/suscripcion";
import { admin, ok } from "./helpers/supabase";
import { borrarBarberia, sembrarBarberiaBI } from "./helpers/semilla-bi";

// La vigencia de la suscripción: la base (v_barberia_modulo vía modulos_barberia) y
// estadoSuscripcion (lib/suscripcion.ts) deben coincidir, ambas con la fecha de Chile.
// Requiere la migración hoy_chile_vigencia aplicada en el proyecto de pruebas.
let s: Awaited<ReturnType<typeof sembrarBarberiaBI>>;

beforeAll(async () => { s = await sembrarBarberiaBI(); });
afterAll(async () => { if (s) await borrarBarberia(s.idBarberia); });

const vigenteEnBD = async () => (ok(await admin.rpc("modulos_barberia", { p_barberia: s.idBarberia })) as string[]).includes("agenda");

describe("vigencia: base de datos y TypeScript coinciden", () => {
  it("hoy_chile() es la fecha de America/Santiago", async () => {
    expect(ok(await admin.rpc("hoy_chile"))).toBe(todayIn());
  });

  it.each([-1, 0, 1])("fecha_termino = hoy %i días", async (dias) => {
    const fecha_termino = addDays(todayIn(), dias);
    ok(await admin.from("suscripcion").update({ estado: "activa", fecha_termino }).eq("id_barberia", s.idBarberia));
    const esperado = estadoSuscripcion({ estado: "activa", fecha_termino, id_suscripcion_externa: null }).vigente;
    expect(esperado).toBe(dias >= 0);
    expect(await vigenteEnBD()).toBe(esperado);
  });
});
