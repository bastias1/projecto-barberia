import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, ok, usuarioPrueba } from "./helpers/supabase";
import { borrarBarberia } from "./helpers/semilla-bi";

// HU-24 (T1): la BD encola en reserva_evento_google los cambios de reservas a sincronizar con Google Calendar
let s: Awaited<ReturnType<typeof sembrar>>;

/** Próximo lunes (UTC) a más de una semana, a las 10:00 + h. */
function lunes(h: number) {
  const d = new Date(Date.now() + 8 * 86_400_000);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  return `${d.toISOString().slice(0, 10)}T${String(10 + h).padStart(2, "0")}:00:00Z`;
}

async function sembrar() {
  const [adm, barbero] = await Promise.all(["gcal-admin", "gcal-barbero"].map(usuarioPrueba));
  const premium = (ok(await admin.from("modulo").select("plan_modulo(id_plan)").eq("codigo", "calendario").single()) as
    unknown as { plan_modulo: { id_plan: number }[] }).plan_modulo[0]?.id_plan;
  const basico = ok(await admin.from("plan_suscripcion").select("id_plan, plan_modulo(id_plan)").eq("activo", true))
    .find((p) => !(p.plan_modulo as unknown[]).length)?.id_plan as number;
  if (!premium || !basico) throw new Error("La base de pruebas necesita un plan con 'calendario' y uno sin módulos");

  const idBarberia = ok(await adm.db.rpc("registrar_barberia", {
    p_nombre: "Pruebas GCal", p_slug: `pruebas-gcal-${Date.now()}`, p_id_plan: premium,
    p_sucursal: "Central", p_direccion: "Calle Falsa 123", p_comuna: "Valdivia", p_zona_horaria: "UTC",
  })) as string;
  const b = { id_barberia: idBarberia };
  const idSucursal = (ok(await admin.from("sucursal").select("id_sucursal").eq("id_barberia", idBarberia).single())).id_sucursal as number;
  ok(await admin.from("usuario_barberia").insert({ ...b, id_usuario: barbero.id, rol: "profesional" }));
  const pros = [adm.id, barbero.id];
  ok(await admin.from("profesional").insert(pros.map((id) => ({ ...b, id_profesional: id }))));
  ok(await admin.from("profesional_sucursal").insert(pros.map((id) => ({ ...b, id_profesional: id, id_sucursal: idSucursal }))));
  const idServicio = (ok(await admin.from("servicio").insert({ ...b, nombre: "Corte", duracion_min: 30, precio: 10000 })
    .select("id_servicio").single())).id_servicio as number;
  ok(await admin.from("profesional_servicio").insert(pros.map((id) => ({ ...b, id_profesional: id, id_servicio: idServicio }))));
  ok(await admin.from("horario_atencion").insert(pros.map((id) => ({
    ...b, id_profesional: id, id_sucursal: idSucursal, dia_semana: 1, hora_inicio: "10:00", hora_fin: "20:00",
  }))));
  const idGuest = (ok(await admin.from("guest_usuario").insert({
    ...b, nombre: "Invitado", apellido: "Prueba", correo: "invitado-gcal@pruebas.navaja.test",
  }).select("id_guest").single())).id_guest as string;

  // Solo el barbero vincula su Google (el token va a Vault; la fila guarda el id del secreto)
  const idSecreto = ok(await admin.rpc("gcal_guardar_token", { p_usuario: barbero.id, p_token: "refresh-de-prueba" })) as string;
  ok(await admin.from("calendario_google").upsert({ id_usuario: barbero.id, email_google: "barbero@gmail.test", id_secreto: idSecreto }));

  let h = 0;
  const reservar = async (idProfesional: string) => (ok(await admin.from("reserva").insert({
    ...b, id_sucursal: idSucursal, id_profesional: idProfesional, id_guest: idGuest, id_servicio: idServicio,
    fecha_hora_inicio: lunes(h++), estado: "pendiente",
  }).select("id_reserva").single())).id_reserva as number;

  return { idBarberia, premium, basico, adm, barbero, reservar };
}

const cola = async (idReserva: number) =>
  ok(await admin.from("reserva_evento_google").select("*").eq("id_reserva", idReserva).maybeSingle());

beforeAll(async () => { s = await sembrar(); });
afterAll(async () => {
  if (!s) return;
  await admin.rpc("gcal_borrar", { p_usuario: s.barbero.id });
  await borrarBarberia(s.idBarberia);
});

describe("HU-24 · cola de sincronización con Google Calendar", () => {
  it("crear una reserva de un barbero vinculado la encola", async () => {
    const id = await s.reservar(s.barbero.id);
    expect(await cola(id)).toMatchObject({ id_barberia: s.idBarberia, id_usuario: s.barbero.id, pendiente: true, intentos: 0 });
  });

  it("cancelarla la vuelve a encolar", async () => {
    const id = await s.reservar(s.barbero.id);
    ok(await admin.from("reserva_evento_google").update({ pendiente: false, intentos: 3, event_id: "evt1" }).eq("id_reserva", id));
    ok(await admin.from("reserva").update({ estado: "cancelada" }).eq("id_reserva", id));
    expect(await cola(id)).toMatchObject({ pendiente: true, intentos: 0, event_id: "evt1" });
  });

  it("sin vínculo de Google no encola", async () => {
    expect(await cola(await s.reservar(s.adm.id))).toBeNull();
  });

  it("sin el módulo calendario encola igual (se sincroniza cuando vuelva el módulo)", async () => {
    ok(await admin.from("suscripcion").update({ id_plan: s.basico }).eq("id_barberia", s.idBarberia));
    try {
      expect(await cola(await s.reservar(s.barbero.id))).toMatchObject({ pendiente: true });
    } finally {
      ok(await admin.from("suscripcion").update({ id_plan: s.premium }).eq("id_barberia", s.idBarberia));
    }
  });

  it("gcal_reclamar no entrega dos veces la misma fila mientras dura la reserva", async () => {
    const id = await s.reservar(s.barbero.id);
    try {
      const primera = ok(await admin.rpc("gcal_reclamar", { p_limite: 500 })) as { id_reserva: number }[];
      expect(primera.map((f) => f.id_reserva)).toContain(id);
      const segunda = ok(await admin.rpc("gcal_reclamar", { p_limite: 500 })) as { id_reserva: number }[];
      expect(segunda.map((f) => f.id_reserva)).not.toContain(id);
      expect((await cola(id))?.bloqueada_hasta).toEqual(expect.any(String));
    } finally {
      ok(await admin.from("reserva_evento_google").update({ bloqueada_hasta: null }).eq("id_barberia", s.idBarberia));
    }
  });

  it("el service role lee el token guardado en Vault", async () => {
    expect(ok(await admin.rpc("gcal_token", { p_usuario: s.barbero.id }))).toBe("refresh-de-prueba");
  });

  it("authenticated no lee tokens ni la cola; ve su propio vínculo sin poder editarlo", async () => {
    const db = s.barbero.db;
    for (const [fn, args] of [["gcal_token", { p_usuario: s.barbero.id }], ["gcal_reclamar", { p_limite: 1 }],
      ["gcal_guardar_token", { p_usuario: s.barbero.id, p_token: "x" }], ["gcal_borrar", { p_usuario: s.barbero.id }]] as const) {
      const { error } = await db.rpc(fn, args);
      expect(error?.code, fn).toBe("42501");
    }
    const { data: filas } = await db.from("reserva_evento_google").select("id_reserva");
    expect(filas ?? []).toEqual([]);

    expect(ok(await db.from("calendario_google").select("email_google"))).toEqual([{ email_google: "barbero@gmail.test" }]);
    await db.from("calendario_google").update({ email_google: "otro@gmail.test" }).eq("id_usuario", s.barbero.id);
    expect(ok(await admin.from("calendario_google").select("email_google").eq("id_usuario", s.barbero.id).single()))
      .toEqual({ email_google: "barbero@gmail.test" });
    expect(ok(await s.adm.db.from("calendario_google").select("id_usuario"))).toEqual([]);
  });
});
