import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, ok } from "./helpers/supabase";
import { borrarBarberia, fecha, sembrarBarberiaBI } from "./helpers/semilla-bi";

// HU-25 · el módulo `pronostico` (Premium) gobierna escritura y lectura de prediccion_demanda
let s: Awaited<ReturnType<typeof sembrarBarberiaBI>>;

beforeAll(async () => { s = await sembrarBarberiaBI(); });
afterAll(async () => {
  if (s) {
    await admin.from("prediccion_demanda").delete().eq("id_barberia", s.idBarberia);
    await borrarBarberia(s.idBarberia);
  }
});

const fila = (valor: number) => ({
  id_barberia: s.idBarberia, tipo: "reservas", fecha_objetivo: fecha(-1),
  valor_estimado: valor, valor_min: valor - 1, valor_max: valor + 1, modelo: "test", mape: 10,
});

describe("HU-25 · módulo pronostico", () => {
  it("con el módulo: el job escribe, el admin lee y re-escribir actualiza la misma fecha", async () => {
    ok(await admin.from("prediccion_demanda").insert(fila(5)));
    const { data } = await s.adm.db.from("prediccion_demanda").select("valor_estimado").eq("id_barberia", s.idBarberia);
    expect(data?.length).toBe(1);
  });

  it("no se duplica la misma fecha", async () => {
    const { error } = await admin.from("prediccion_demanda").insert(fila(6));
    expect(error?.code).toBe("23505");
  });

  it("el margen debe envolver al estimado", async () => {
    const { error } = await admin.from("prediccion_demanda").insert({ ...fila(5), fecha_objetivo: fecha(-2), valor_min: 9 });
    expect(error?.code).toBe("23514");
  });

  it("sin el módulo: no se puede escribir ni el admin ve lo ya escrito", async () => {
    ok(await admin.from("suscripcion").update({ id_plan: s.planSinBi }).eq("id_barberia", s.idBarberia));
    try {
      const { error } = await admin.from("prediccion_demanda").insert({ ...fila(5), fecha_objetivo: fecha(-3) });
      expect(error?.code).toBe("23514");
      const { data } = await s.adm.db.from("prediccion_demanda").select("id_prediccion").eq("id_barberia", s.idBarberia);
      expect(data).toEqual([]);
    } finally {
      ok(await admin.from("suscripcion").update({ id_plan: s.planConBi }).eq("id_barberia", s.idBarberia));
    }
  });

  it("historial_demanda solo lo ejecuta el service role", async () => {
    const args = { p_barberia: s.idBarberia, p_desde: fecha(182), p_hasta: fecha(0) };
    expect((ok(await admin.rpc("historial_demanda", args)) as unknown[]).length).toBeGreaterThan(0);
    expect((await s.adm.db.rpc("historial_demanda", args)).error).not.toBeNull();
  });
});
