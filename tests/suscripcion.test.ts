import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("../lib/notifications", () => ({ notificarSuscripcion: vi.fn() }));
vi.mock("../lib/pagos", () => ({ mercadoPagoClient: vi.fn(), registrarPagoCobro: vi.fn() }));

import { registrarPagoCobro } from "../lib/pagos";
import {
  activarCortesia, aplicarCobroSuscripcion, aplicarPreapproval, cambiarPlan, cancelar, eliminarSuscripcion, estadoSuscripcion, extenderVigencia,
  avisarVencimientos, sincronizarCobros, sumarMes, suscribir, type PasarelaSuscripcion,
} from "../lib/suscripcion";

describe("sumarMes", () => {
  it("no se pasa al mes siguiente a fin de mes", () => {
    expect(sumarMes("2026-01-31")).toBe("2026-02-28");
    expect(sumarMes("2028-01-31")).toBe("2028-02-29");
    expect(sumarMes("2026-03-31")).toBe("2026-04-30");
  });
  it("conserva el día cuando existe y cruza el año", () => {
    expect(sumarMes("2026-10-20")).toBe("2026-11-20");
    expect(sumarMes("2026-12-15")).toBe("2027-01-15");
  });
});

// ---------------------------------------------------------------- vigencia

describe("estadoSuscripcion", () => {
  const sus = (extra: Record<string, unknown> = {}) => ({ estado: "activa", fecha_termino: null, id_suscripcion_externa: null, ...extra }) as never;
  const hoy = "2026-11-23";

  it.each([
    ["barbería suspendida", sus(), { barberiaActiva: false, hoy }, "suspendida", false],
    ["sin suscripción", null, { hoy }, "sin", false],
    ["prueba que termina hoy sigue vigente", sus({ estado: "prueba", fecha_termino: "2026-11-23" }), { hoy }, "prueba", true],
    ["prueba que terminó ayer", sus({ estado: "prueba", fecha_termino: "2026-11-22" }), { hoy }, "vencida", false],
    ["activa con fecha pasada", sus({ fecha_termino: "2026-11-01" }), { hoy }, "vencida", false],
    ["estado cancelada aunque le queden días", sus({ estado: "cancelada", fecha_termino: "2026-12-30" }), { hoy }, "vencida", false],
    ["renovación automática", sus({ fecha_termino: "2026-12-28", id_suscripcion_externa: "PRE1" }), { hoy }, "activa_mp", true],
    ["cortesía con fecha", sus({ fecha_termino: "2026-12-28" }), { hoy }, "cortesia", true],
    ["activa sin vencimiento", sus(), { hoy }, "activa", true],
  ])("%s", (_nombre, s, opts, clave, vigente) => {
    expect(estadoSuscripcion(s, opts)).toEqual({ clave, vigente });
  });

  describe("sin `hoy`: usa la fecha de Chile, no la UTC", () => {
    afterEach(() => vi.useRealTimers());
    const venceEl = (fecha: string) => sus({ fecha_termino: fecha });

    it("invierno (UTC-4): 02:30 UTC del 1 de julio aún es 30 de junio", () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-07-01T02:30:00Z"));
      expect(estadoSuscripcion(venceEl("2026-06-30")).vigente).toBe(true);
    });
    it("verano (UTC-3): 02:30 UTC del 1 de diciembre aún es 30 de noviembre; 03:30 UTC ya es 1 de diciembre", () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-12-01T02:30:00Z"));
      expect(estadoSuscripcion(venceEl("2026-11-30")).vigente).toBe(true);
      vi.setSystemTime(new Date("2026-12-01T03:30:00Z"));
      expect(estadoSuscripcion(venceEl("2026-11-30")).vigente).toBe(false);
    });
  });
});

// ---------------------------------------------------------------- transiciones (BD y Mercado Pago falsos)

type Fila = Record<string, unknown>;

/** Mini Supabase en memoria: solo las cadenas que usa el módulo. */
function bd(tablas: Record<string, Fila[]>) {
  return {
    from(tabla: string) {
      const filtros: ((f: Fila) => boolean)[] = [];
      let patch: Fila | null = null;
      let columna = "";
      let desc = false;
      let max = Infinity;
      const ejecutar = () => {
        let filas = (tablas[tabla] ?? []).filter((f) => filtros.every((g) => g(f)));
        if (columna) filas = [...filas].sort((a, b) => (Number(a[columna]) - Number(b[columna])) * (desc ? -1 : 1));
        filas = filas.slice(0, max);
        // Como la BD real: lo leído es una copia; el update modifica la fila guardada
        const leidas = filas.map((f) => ({ ...f }));
        if (patch) filas.forEach((f) => Object.assign(f, patch));
        return leidas;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = {
        select: () => q,
        update: (p: Fila) => ((patch = p), q),
        eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
        not: (c: string, _op: string, v: unknown) => (filtros.push((f) => f[c] !== v), q),
        is: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
        in: (c: string, v: unknown[]) => (filtros.push((f) => v.includes(f[c])), q),
        gte: (c: string, v: string) => (filtros.push((f) => String(f[c]) >= v), q),
        lte: (c: string, v: string) => (filtros.push((f) => String(f[c]) <= v), q),
        order: (c: string, o: { ascending: boolean }) => ((columna = c), (desc = !o.ascending), q),
        limit: (n: number) => ((max = n), q),
        maybeSingle: async () => ({ data: ejecutar()[0] ?? null }),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: ejecutar(), error: null }).then(res, rej),
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

const fila = (extra: Fila = {}): Fila => ({
  id_suscripcion: 3, id_barberia: "b1", id_plan: 1, estado: "activa", fecha_termino: "2026-12-20",
  precio_pactado: 29990, id_suscripcion_externa: "PRE1", ...extra,
});
const PLAN = { id_plan: 2, nombre: "Pro", precio_mensual: 49990, activo: true };
const HOY = "2026-11-23";

function pasarela(extra: Partial<PasarelaSuscripcion> = {}) {
  return { crear: vi.fn(), cancelar: vi.fn().mockResolvedValue(undefined), cobros: vi.fn().mockResolvedValue([]), ...extra } as PasarelaSuscripcion;
}
const preapproval = (extra: Fila = {}) => ({ id: "PRE2", status: "authorized", external_reference: "suscripcion:3:plan:2", auto_recurring: { transaction_amount: 49990 }, ...extra }) as never;

let avisar: ReturnType<typeof vi.fn>;
beforeEach(() => {
  avisar = vi.fn().mockResolvedValue(true);
  vi.mocked(registrarPagoCobro).mockReset().mockResolvedValue("aprobado");
});
const silenciar = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("aplicarPreapproval", () => {
  it("autorizada: activa el plan, congela el precio y da gracia sin cortar el servicio", async () => {
    const s = fila({ id_suscripcion_externa: null, fecha_termino: "2026-11-25", estado: "prueba" });
    await aplicarPreapproval(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), preapproval(), { pasarela: pasarela(), avisar, hoy: HOY } as never);
    expect(s).toMatchObject({ estado: "activa", id_plan: 2, precio_pactado: 49990, id_suscripcion_externa: "PRE2", fecha_termino: "2026-11-28" });
  });

  it("sin fecha de término la deja indefinida", async () => {
    const s = fila({ id_suscripcion_externa: null, fecha_termino: null });
    await aplicarPreapproval(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), preapproval(), { pasarela: pasarela(), hoy: HOY });
    expect(s.fecha_termino).toBeNull();
  });

  it("cambio de plan: cancela la preapproval anterior, y si eso falla no rompe", async () => {
    const error = silenciar();
    const p = pasarela({ cancelar: vi.fn().mockRejectedValue(new Error("MP caído")) });
    const s = fila();
    await aplicarPreapproval(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), preapproval(), { pasarela: p, hoy: HOY });
    expect(p.cancelar).toHaveBeenCalledWith("PRE1");
    expect(s.id_suscripcion_externa).toBe("PRE2");
    error.mockRestore();
  });

  it("referencia ajena o suscripción inexistente: no hace nada", async () => {
    const error = silenciar();
    const s = fila();
    const db = bd({ suscripcion: [s], plan_suscripcion: [PLAN] });
    await aplicarPreapproval(db, preapproval({ external_reference: "otra-cosa" }), { hoy: HOY });
    await aplicarPreapproval(db, preapproval({ external_reference: "suscripcion:99:plan:2" }), { hoy: HOY });
    expect(s.id_suscripcion_externa).toBe("PRE1");
    error.mockRestore();
  });
});

describe("cancelación de la renovación automática", () => {
  it("el dueño cancela: Mercado Pago, referencia suelta, sigue activa hasta su fecha y avisa una vez", async () => {
    const s = fila({ fecha_termino: "2026-12-20" });
    const p = pasarela();
    expect(await cancelar(bd({ suscripcion: [s] }), "b1", { pasarela: p, avisar, hoy: HOY } as never)).toEqual({ ok: true });
    expect(p.cancelar).toHaveBeenCalledWith("PRE1");
    expect(s).toMatchObject({ id_suscripcion_externa: null, estado: "activa" });
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar).toHaveBeenCalledWith("b1", "cancelada");
  });

  it("si ya no le quedan días pasa a cancelada", async () => {
    const s = fila({ fecha_termino: "2026-11-01" });
    await cancelar(bd({ suscripcion: [s] }), "b1", { pasarela: pasarela(), avisar, hoy: HOY } as never);
    expect(s.estado).toBe("cancelada");
  });

  it("el webhook que llega después de que cancelara el dueño no repite el aviso", async () => {
    const db = bd({ suscripcion: [fila()] });
    const opts = { pasarela: pasarela(), avisar, hoy: HOY } as never;
    await cancelar(db, "b1", opts);
    await aplicarPreapproval(db, preapproval({ id: "PRE1", status: "cancelled" }), opts);
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("cancelada por webhook (o pausada): avisa, y un webhook repetido no avisa de nuevo", async () => {
    const s = fila();
    const db = bd({ suscripcion: [s] });
    const opts = { pasarela: pasarela(), avisar, hoy: HOY } as never;
    await aplicarPreapproval(db, preapproval({ id: "PRE1", status: "paused" }), opts);
    await aplicarPreapproval(db, preapproval({ id: "PRE1", status: "cancelled" }), opts);
    expect(s.id_suscripcion_externa).toBeNull();
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("un fallo del aviso no deshace la cancelación", async () => {
    const error = silenciar();
    const s = fila();
    avisar.mockRejectedValue(new Error("sin correo"));
    expect(await cancelar(bd({ suscripcion: [s] }), "b1", { pasarela: pasarela(), avisar, hoy: HOY } as never)).toEqual({ ok: true });
    expect(s.id_suscripcion_externa).toBeNull();
    error.mockRestore();
  });

  it("sin renovación automática: 404 y no llama a Mercado Pago", async () => {
    const p = pasarela();
    const r = await cancelar(bd({ suscripcion: [fila({ id_suscripcion_externa: null })] }), "b1", { pasarela: p, avisar, hoy: HOY } as never);
    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(p.cancelar).not.toHaveBeenCalled();
  });

  it("si Mercado Pago falla: 502, la referencia queda y no avisa", async () => {
    const error = silenciar();
    const s = fila();
    const r = await cancelar(bd({ suscripcion: [s] }), "b1", { pasarela: pasarela({ cancelar: vi.fn().mockRejectedValue(new Error("x")) }), avisar, hoy: HOY } as never);
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(s.id_suscripcion_externa).toBe("PRE1");
    expect(avisar).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("eliminarSuscripcion", () => {
  it("cancela el cobro en Mercado Pago y deja la suscripción cancelada", async () => {
    const p = pasarela();
    const s = fila();
    const r = await eliminarSuscripcion(bd({ suscripcion: [s] }), "b1", { pasarela: p });
    expect(r).toMatchObject({ ok: true, despues: { estado: "cancelada", cobro_automatico: false } });
    expect(p.cancelar).toHaveBeenCalledWith("PRE1");
    expect(s).toMatchObject({ estado: "cancelada", id_suscripcion_externa: null });
  });

  it("sin cobro automático no llama a Mercado Pago", async () => {
    const p = pasarela();
    const s = fila({ id_suscripcion_externa: null, estado: "prueba" });
    expect(await eliminarSuscripcion(bd({ suscripcion: [s] }), "b1", { pasarela: p })).toMatchObject({ ok: true });
    expect(p.cancelar).not.toHaveBeenCalled();
    expect(s.estado).toBe("cancelada");
  });

  it("si Mercado Pago falla: 502 y no cambia nada", async () => {
    const error = silenciar();
    const s = fila();
    const r = await eliminarSuscripcion(bd({ suscripcion: [s] }), "b1", { pasarela: pasarela({ cancelar: vi.fn().mockRejectedValue(new Error("x")) }) });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(s).toMatchObject({ estado: "activa", id_suscripcion_externa: "PRE1" });
    error.mockRestore();
  });

  it("sin suscripción: 404; ya cancelada: 409", async () => {
    expect(await eliminarSuscripcion(bd({ suscripcion: [] }), "b1", { pasarela: pasarela() })).toMatchObject({ ok: false, status: 404 });
    const cancelada = fila({ estado: "cancelada", id_suscripcion_externa: null });
    expect(await eliminarSuscripcion(bd({ suscripcion: [cancelada] }), "b1", { pasarela: pasarela() })).toMatchObject({ ok: false, status: 409 });
  });
});

describe("cobros", () => {
  const cobro = { id: 9, preapproval_id: "PRE1", debit_date: "2026-11-23T12:00:00.000-03:00", payment: { status: "approved" } };

  it("cobro aprobado: un mes desde el cobro más la gracia", async () => {
    const s = fila({ fecha_termino: "2026-11-25", estado: "prueba" });
    await aplicarCobroSuscripcion(bd({ suscripcion: [s] }), cobro, { hoy: HOY });
    expect(s).toMatchObject({ estado: "activa", fecha_termino: "2026-12-28" });
  });

  it("nunca acorta una vigencia más larga", async () => {
    const s = fila({ fecha_termino: "2027-03-01" });
    await aplicarCobroSuscripcion(bd({ suscripcion: [s] }), cobro, { hoy: HOY });
    expect(s.fecha_termino).toBe("2027-03-01");
  });

  it("sin debit_date cuenta desde hoy (Chile)", async () => {
    const s = fila({ fecha_termino: null });
    await aplicarCobroSuscripcion(bd({ suscripcion: [s] }), { ...cobro, debit_date: undefined }, { hoy: "2026-01-31" });
    expect(s.fecha_termino).toBe("2026-03-05"); // 31 ene + 1 mes = 28 feb, + 5 días
  });

  it("cobro rechazado: se registra pero no extiende", async () => {
    vi.mocked(registrarPagoCobro).mockResolvedValue("rechazado");
    const s = fila({ fecha_termino: "2026-11-25" });
    await aplicarCobroSuscripcion(bd({ suscripcion: [s] }), cobro, { hoy: HOY });
    expect(registrarPagoCobro).toHaveBeenCalled();
    expect(s.fecha_termino).toBe("2026-11-25");
  });

  it("sincronizarCobros aplica cada cobro de Mercado Pago, y si falla solo lo deja en el log", async () => {
    const s = fila({ fecha_termino: "2026-11-25" });
    const p = pasarela({ cobros: vi.fn().mockResolvedValue([cobro]) });
    await sincronizarCobros(bd({ suscripcion: [s] }), "PRE1", { pasarela: p, hoy: HOY });
    expect(p.cobros).toHaveBeenCalledWith("PRE1");
    expect(s.fecha_termino).toBe("2026-12-28");

    const error = silenciar();
    await expect(sincronizarCobros(bd({ suscripcion: [s] }), "PRE1", { pasarela: pasarela({ cobros: vi.fn().mockRejectedValue(new Error("x")) }) })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("suscribir", () => {
  const datos = { barberia: { id_barberia: "b1", nombre: "Benjvmin", slug: "benjvmin" }, email: "dueno@correo.cl", idPlan: 2, token: "tok" };

  it("camino feliz: crea la preapproval, la aplica y sincroniza el primer cobro", async () => {
    const s = fila({ id_suscripcion_externa: null, estado: "prueba", fecha_termino: "2026-11-25" });
    const p = pasarela({ crear: vi.fn().mockResolvedValue(preapproval()) });
    expect(await suscribir(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), datos, { pasarela: p, hoy: HOY })).toEqual({ ok: true, estado: "authorized" });
    expect(p.crear).toHaveBeenCalledWith(expect.objectContaining({
      external_reference: "suscripcion:3:plan:2", card_token_id: "tok", status: "authorized",
      auto_recurring: expect.objectContaining({ transaction_amount: 49990, currency_id: "CLP" }),
    }));
    expect(s).toMatchObject({ estado: "activa", id_plan: 2, id_suscripcion_externa: "PRE2" });
    expect(p.cobros).toHaveBeenCalledWith("PRE2");
  });

  it.each([
    ["plan inexistente o inactivo", { suscripcion: [fila()], plan_suscripcion: [] }, datos, 400],
    ["barbería sin suscripción", { suscripcion: [], plan_suscripcion: [PLAN] }, datos, 404],
    ["ya paga ese plan", { suscripcion: [fila({ id_plan: 2 })], plan_suscripcion: [PLAN] }, datos, 409],
    ["plan bajo el mínimo de Mercado Pago", { suscripcion: [fila()], plan_suscripcion: [{ ...PLAN, precio_mensual: 500 }] }, datos, 400],
  ])("%s: %i sin llamar a Mercado Pago", async (_nombre, tablas, d, status) => {
    const p = pasarela();
    expect(await suscribir(bd(tablas as never), d, { pasarela: p, hoy: HOY })).toMatchObject({ ok: false, status });
    expect(p.crear).not.toHaveBeenCalled();
  });

  it.each([
    ["Card token was generated without cvv validation", /código de seguridad/],
    ["Card token was used", /expiró/],
    ["error CC_VAL_433", /tarjeta de crédito/],
    ["cualquier otra cosa", /rechazó la tarjeta/],
  ])("error de Mercado Pago «%s» → 402 con un mensaje para el dueño", async (mensaje, esperado) => {
    const error = silenciar();
    const p = pasarela({ crear: vi.fn().mockRejectedValue(new Error(mensaje)) });
    const s = fila();
    const r = await suscribir(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), datos, { pasarela: p, hoy: HOY });
    expect(r).toMatchObject({ ok: false, status: 402, error: expect.stringMatching(esperado) });
    expect(s.id_suscripcion_externa).toBe("PRE1");
    error.mockRestore();
  });

  it("preapproval que no quedó autorizada: 402 y no cambia nada", async () => {
    const error = silenciar();
    const s = fila();
    const p = pasarela({ crear: vi.fn().mockResolvedValue(preapproval({ status: "pending" })) });
    expect(await suscribir(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), datos, { pasarela: p, hoy: HOY })).toMatchObject({ ok: false, status: 402 });
    expect(s.id_suscripcion_externa).toBe("PRE1");
    error.mockRestore();
  });
});

describe("acciones del superadmin", () => {
  it("extenderVigencia: reactiva una vencida o cancelada y deja antes/después para la bitácora", async () => {
    const s = fila({ estado: "cancelada", fecha_termino: "2026-10-01" });
    const r = await extenderVigencia(bd({ suscripcion: [s] }), "b1", "2027-01-15");
    expect(r).toEqual({ ok: true, antes: { fecha_termino: "2026-10-01", estado: "cancelada" }, despues: { fecha_termino: "2027-01-15", estado: "activa" } });
    expect(s).toMatchObject({ estado: "activa", fecha_termino: "2027-01-15" });
  });

  it("extenderVigencia: una prueba sigue siendo prueba; fecha inválida o sin suscripción se rechazan", async () => {
    const s = fila({ estado: "prueba" });
    await extenderVigencia(bd({ suscripcion: [s] }), "b1", "2027-01-15");
    expect(s.estado).toBe("prueba");
    expect(await extenderVigencia(bd({ suscripcion: [s] }), "b1", "15/01/2027")).toMatchObject({ ok: false, status: 400 });
    expect(await extenderVigencia(bd({ suscripcion: [] }), "b1", "2027-01-15")).toMatchObject({ ok: false, status: 404 });
  });

  it("cambiarPlan: actualiza plan y precio pactado, pero no toca la renovación de Mercado Pago", async () => {
    const s = fila();
    const r = await cambiarPlan(bd({ suscripcion: [s], plan_suscripcion: [PLAN] }), "b1", 2);
    expect(r).toMatchObject({ ok: true, despues: { id_plan: 2, plan: "Pro", precio_pactado: 49990 } });
    expect(s).toMatchObject({ id_plan: 2, precio_pactado: 49990, id_suscripcion_externa: "PRE1" });
    expect(await cambiarPlan(bd({ suscripcion: [s], plan_suscripcion: [] }), "b1", 9)).toMatchObject({ ok: false, status: 404 });
  });

  it("activarCortesia: se rechaza con renovación automática (Mercado Pago seguiría cobrando)", async () => {
    const s = fila();
    expect(await activarCortesia(bd({ suscripcion: [s] }), "b1", null)).toMatchObject({ ok: false, status: 409 });
    expect(s.estado).toBe("activa");
  });

  it("activarCortesia: sin cobro queda activa, con o sin fecha", async () => {
    const s = fila({ id_suscripcion_externa: null, estado: "vencida", fecha_termino: "2026-10-01" });
    expect(await activarCortesia(bd({ suscripcion: [s] }), "b1", null)).toMatchObject({ ok: true });
    expect(s).toMatchObject({ estado: "activa", fecha_termino: null });
    expect(await activarCortesia(bd({ suscripcion: [s] }), "b1", "mañana")).toMatchObject({ ok: false, status: 400 });
  });
});

// ---------------------------------------------------------------- avisos de vencimiento

describe("avisarVencimientos", () => {
  const avisar = () => vi.fn().mockResolvedValue(true);

  it("avisa 'vencida' y 'por_vencer' (sin renovación) una sola vez por fecha de término", async () => {
    const filas = [
      fila({ id_suscripcion: 1, id_barberia: "vencida", fecha_termino: "2026-11-22", id_suscripcion_externa: null, aviso_enviado: null }),
      fila({ id_suscripcion: 2, id_barberia: "por-vencer", fecha_termino: "2026-11-25", id_suscripcion_externa: null, aviso_enviado: null }),
      fila({ id_suscripcion: 3, id_barberia: "con-mp", fecha_termino: "2026-11-25", aviso_enviado: null }),
      fila({ id_suscripcion: 4, id_barberia: "ya-avisada", fecha_termino: "2026-11-25", id_suscripcion_externa: null, aviso_enviado: "por_vencer:2026-11-25" }),
      fila({ id_suscripcion: 5, id_barberia: "lejana", fecha_termino: "2026-12-20", id_suscripcion_externa: null, aviso_enviado: null }),
    ];
    const a = avisar();
    expect(await avisarVencimientos(bd({ suscripcion: filas }), { hoy: HOY, avisar: a })).toBe(2);
    expect(a.mock.calls).toEqual([["vencida", "vencida"], ["por-vencer", "por_vencer"]]);
    expect(filas[0].aviso_enviado).toBe("vencida:2026-11-22");
  });

  it("termina hoy en Chile: aún vigente, avisa 'por_vencer' (no 'vencida')", async () => {
    const filas = [fila({ fecha_termino: HOY, id_suscripcion_externa: null, aviso_enviado: null })];
    const a = avisar();
    await avisarVencimientos(bd({ suscripcion: filas }), { hoy: HOY, avisar: a });
    expect(a).toHaveBeenCalledWith("b1", "por_vencer");
  });

  it("si el correo no sale, libera el reclamo para reintentar", async () => {
    const filas = [fila({ fecha_termino: "2026-11-22", id_suscripcion_externa: null, aviso_enviado: null })];
    await avisarVencimientos(bd({ suscripcion: filas }), { hoy: HOY, avisar: vi.fn().mockResolvedValue(false) });
    expect(filas[0].aviso_enviado).toBeNull();
  });
});
