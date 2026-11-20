import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accionEvento, sincronizarPendientes } from "../lib/google-calendar";
import { admin, ok, usuarioPrueba } from "./helpers/supabase";
import { borrarBarberia } from "./helpers/semilla-bi";

describe("HU-24 · accionEvento", () => {
  it.each([
    ["pendiente", null, "crear"], ["confirmada", null, "crear"],
    ["pendiente", "e1", "actualizar"], ["confirmada", "e1", "actualizar"],
    ["cancelada", "e1", "borrar"], ["no_asistio", "e1", "borrar"],
    ["cancelada", null, "nada"], ["no_asistio", null, "nada"],
    ["completada", "e1", "nada"], ["completada", null, "nada"],
  ])("%s con evento %s → %s", (estado, eventId, esperado) => {
    expect(accionEvento({ estado }, eventId)).toBe(esperado);
  });
});

// sincronizarPendientes contra la base de pruebas, con la API de Google simulada
type Llamada = { metodo: string; url: string; body: Record<string, unknown> | null };
let llamadas: Llamada[] = [];
let responder: (l: Llamada) => Response = () => new Response("{}");

const googleFalso = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const body = init?.body;
  const l: Llamada = {
    metodo: init?.method ?? "GET", url: String(input),
    body: typeof body === "string" ? JSON.parse(body) : body instanceof URLSearchParams ? Object.fromEntries(body) : null,
  };
  llamadas.push(l);
  return responder(l);
}) as typeof fetch;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const googleOk = (l: Llamada) =>
  l.url.includes("oauth2") ? json({ access_token: "at-prueba", expires_in: 3600 })
    : l.metodo === "DELETE" ? new Response(null, { status: 204 })
      : json({ id: l.metodo === "POST" ? "evt-nuevo" : l.url.split("/").pop() });

let s: Awaited<ReturnType<typeof sembrar>>;

function lunes(h: number) {
  const d = new Date(Date.now() + 8 * 86_400_000);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  return `${d.toISOString().slice(0, 10)}T${String(10 + h).padStart(2, "0")}:00:00Z`;
}

async function sembrar() {
  const [adm, barbero] = await Promise.all(["gsync-admin", "gsync-barbero"].map(usuarioPrueba));
  const premium = (ok(await admin.from("modulo").select("plan_modulo(id_plan)").eq("codigo", "calendario").single()) as
    unknown as { plan_modulo: { id_plan: number }[] }).plan_modulo[0]?.id_plan;
  if (!premium) throw new Error("La base de pruebas necesita un plan con 'calendario'");

  const idBarberia = ok(await adm.db.rpc("registrar_barberia", {
    p_nombre: "Pruebas GSync", p_slug: `pruebas-gsync-${Date.now()}`, p_id_plan: premium,
    p_sucursal: "Central", p_direccion: "Calle Falsa 123", p_comuna: "Valdivia", p_zona_horaria: "America/Santiago",
  })) as string;
  const b = { id_barberia: idBarberia };
  const idSucursal = (ok(await admin.from("sucursal").select("id_sucursal").eq("id_barberia", idBarberia).single())).id_sucursal as number;
  ok(await admin.from("usuario_barberia").insert({ ...b, id_usuario: barbero.id, rol: "profesional" }));
  ok(await admin.from("profesional").insert({ ...b, id_profesional: barbero.id }));
  ok(await admin.from("profesional_sucursal").insert({ ...b, id_profesional: barbero.id, id_sucursal: idSucursal }));
  const idServicio = (ok(await admin.from("servicio").insert({ ...b, nombre: "Corte", duracion_min: 30, precio: 10000 })
    .select("id_servicio").single())).id_servicio as number;
  ok(await admin.from("profesional_servicio").insert({ ...b, id_profesional: barbero.id, id_servicio: idServicio }));
  // horario amplio en UTC-3/-4: las reservas sembradas en UTC caen dentro
  ok(await admin.from("horario_atencion").insert({
    ...b, id_profesional: barbero.id, id_sucursal: idSucursal, dia_semana: 1, hora_inicio: "00:00", hora_fin: "23:59",
  }));
  const idGuest = (ok(await admin.from("guest_usuario").insert({
    ...b, nombre: "Pedro", apellido: "González", correo: "invitado-gsync@pruebas.navaja.test",
  }).select("id_guest").single())).id_guest as string;

  const idSecreto = ok(await admin.rpc("gcal_guardar_token", { p_usuario: barbero.id, p_token: "refresh-de-prueba" })) as string;
  ok(await admin.from("calendario_google").upsert({ id_usuario: barbero.id, email_google: "gsync@gmail.test", id_secreto: idSecreto }));

  let h = 0;
  const reservar = async () => (ok(await admin.from("reserva").insert({
    ...b, id_sucursal: idSucursal, id_profesional: barbero.id, id_guest: idGuest, id_servicio: idServicio,
    fecha_hora_inicio: lunes(h++), estado: "pendiente",
  }).select("id_reserva, fecha_hora_inicio").single())) as { id_reserva: number; fecha_hora_inicio: string };

  return { idBarberia, barbero, reservar };
}

const cola = async (idReserva: number) =>
  ok(await admin.from("reserva_evento_google").select("*").eq("id_reserva", idReserva).single());
const sincronizar = () => sincronizarPendientes(50, admin, googleFalso);

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = "cliente-prueba";
  process.env.GOOGLE_CLIENT_SECRET = "secreto-prueba";
  s = await sembrar();
});
afterAll(async () => {
  if (!s) return;
  await admin.rpc("gcal_borrar", { p_usuario: s.barbero.id });
  await borrarBarberia(s.idBarberia);
});

describe("HU-24 · sincronizarPendientes", () => {
  it("crea el evento de una reserva encolada y la saca de la cola", async () => {
    const r = await s.reservar();
    llamadas = []; responder = googleOk;
    await sincronizar();

    const token = llamadas.find((l) => l.url.includes("oauth2"));
    expect(token?.body).toMatchObject({ grant_type: "refresh_token", refresh_token: "refresh-de-prueba", client_id: "cliente-prueba" });
    const crear = llamadas.find((l) => l.metodo === "POST" && l.url.endsWith("/calendars/primary/events"));
    expect(crear?.body).toMatchObject({
      summary: "Corte · Pedro G.", location: "Calle Falsa 123",
      start: { timeZone: "America/Santiago" }, end: { timeZone: "America/Santiago" },
    });
    expect(new Date((crear?.body?.start as { dateTime: string }).dateTime).getTime()).toBe(new Date(r.fecha_hora_inicio).getTime());
    expect(await cola(r.id_reserva)).toMatchObject({ pendiente: false, event_id: "evt-nuevo", ultimo_error: null });
  });

  it("reprogramar mueve el evento y cancelar lo borra", async () => {
    const r = await s.reservar();
    responder = googleOk;
    await sincronizar();

    const nueva = new Date(new Date(r.fecha_hora_inicio).getTime() + 5 * 3_600_000).toISOString();
    ok(await admin.from("reserva").update({ fecha_hora_inicio: nueva }).eq("id_reserva", r.id_reserva));
    llamadas = [];
    await sincronizar();
    const patch = llamadas.find((l) => l.metodo === "PATCH");
    expect(patch?.url).toMatch(/\/calendars\/primary\/events\/evt-nuevo$/);
    expect(new Date((patch?.body?.start as { dateTime: string }).dateTime).toISOString()).toBe(nueva);
    expect(await cola(r.id_reserva)).toMatchObject({ pendiente: false, event_id: "evt-nuevo" });

    ok(await admin.from("reserva").update({ estado: "cancelada" }).eq("id_reserva", r.id_reserva));
    llamadas = [];
    await sincronizar();
    expect(llamadas.find((l) => l.metodo === "DELETE")?.url).toMatch(/\/events\/evt-nuevo$/);
    expect(await cola(r.id_reserva)).toMatchObject({ pendiente: false, event_id: null });
  });

  it("un 5xx de Google suma un intento y la deja pendiente", async () => {
    const r = await s.reservar();
    responder = (l) => l.url.includes("oauth2") ? googleOk(l) : json({ error: { message: "Backend Error" } }, 503);
    await sincronizar();
    expect(await cola(r.id_reserva)).toMatchObject({ pendiente: true, intentos: 1, ultimo_error: "Google 503: Backend Error" });

    responder = googleOk;
    await sincronizar();
    expect(await cola(r.id_reserva)).toMatchObject({ pendiente: false, event_id: "evt-nuevo", ultimo_error: null });
  });

  it("invalid_grant deja el error en calendario_google y no toca los eventos", async () => {
    const r = await s.reservar();
    llamadas = [];
    responder = (l) => l.url.includes("oauth2") ? json({ error: "invalid_grant" }, 400) : googleOk(l);
    await sincronizar();
    expect(llamadas.some((l) => l.url.includes("/events"))).toBe(false);
    expect(ok(await admin.from("calendario_google").select("ultimo_error, ultimo_error_at").eq("id_usuario", s.barbero.id).single()))
      .toMatchObject({ ultimo_error: expect.stringContaining("vuelve a conectar"), ultimo_error_at: expect.any(String) });
    expect(await cola(r.id_reserva)).toMatchObject({ pendiente: true, intentos: 1 });

    responder = googleOk;
    await sincronizar();
    expect(ok(await admin.from("calendario_google").select("ultimo_error").eq("id_usuario", s.barbero.id).single()))
      .toEqual({ ultimo_error: null });
  });
});
