import { admin, ok, usuarioPrueba } from "./supabase";

/**
 * Barbería de pruebas con ~6 meses de historia (CP-04): un barbero y el admin que también atiende,
 * ~1500 reservas en estados mezclados y ~90 pedidos pagados. La sucursal usa zona horaria UTC
 * para que las horas sembradas sean las locales sin conversión.
 */
export const DIAS = 183;
const ESTADOS = ["completada", "completada", "completada", "completada", "completada", "completada", "completada",
  "no_asistio", "cancelada", "confirmada"];
const HORAS_BARBERO = [10, 11, 12, 13, 15, 16, 17, 18];
const HORAS_ADMIN = [10, 12];

export const fecha = (diasAtras: number) => new Date(Date.now() - diasAtras * 86_400_000).toISOString().slice(0, 10);

async function enLotes(tabla: string, filas: Record<string, unknown>[]) {
  for (let i = 0; i < filas.length; i += 500) ok(await admin.from(tabla).insert(filas.slice(i, i + 500)));
}

export async function sembrarBarberiaBI() {
  const [adm, barbero, cliente, superadmin] = await Promise.all(
    ["admin", "barbero", "cliente", "superadmin"].map(usuarioPrueba));
  ok(await admin.from("usuario").update({ rol: "superadmin" }).eq("id_usuario", superadmin.id));

  const planes = ok(await admin.from("plan_suscripcion")
    .select("id_plan, plan_modulo(modulo(codigo))").eq("activo", true)) as unknown as
    { id_plan: number; plan_modulo: { modulo: { codigo: string } }[] }[];
  const tieneBi = (p: (typeof planes)[number]) => p.plan_modulo.some((pm) => pm.modulo.codigo === "bi");
  const planConBi = planes.find(tieneBi)?.id_plan;
  const planSinBi = planes.find((p) => !tieneBi(p))?.id_plan;
  if (!planConBi || !planSinBi) throw new Error("La base de pruebas necesita un plan activo con 'bi' y otro sin 'bi'");
  const idModuloBi = (ok(await admin.from("modulo").select("id_modulo").eq("codigo", "bi").single())).id_modulo as number;

  const idBarberia = ok(await adm.db.rpc("registrar_barberia", {
    p_nombre: "Pruebas BI", p_slug: `pruebas-bi-${Date.now()}`, p_id_plan: planConBi,
    p_sucursal: "Central", p_direccion: "Calle Falsa 123", p_comuna: "Valdivia", p_zona_horaria: "UTC",
  })) as string;
  const b = { id_barberia: idBarberia };
  // Los usuarios de prueba se reutilizan y ya gastaron su prueba gratis
  ok(await admin.from("suscripcion").update({ estado: "activa", fecha_termino: null }).eq("id_barberia", idBarberia));
  const idSucursal = (ok(await admin.from("sucursal").select("id_sucursal").eq("id_barberia", idBarberia).single())).id_sucursal as number;

  ok(await admin.from("usuario_barberia").insert([
    { ...b, id_usuario: barbero.id, rol: "profesional" }, { ...b, id_usuario: cliente.id, rol: "cliente" },
  ]));
  const pros = [adm.id, barbero.id];
  ok(await admin.from("profesional").insert(pros.map((id) => ({ ...b, id_profesional: id }))));
  ok(await admin.from("profesional_sucursal").insert(pros.map((id) => ({ ...b, id_profesional: id, id_sucursal: idSucursal }))));
  const servicios = ok(await admin.from("servicio").insert([
    { ...b, nombre: "Corte", duracion_min: 30, precio: 10000 }, { ...b, nombre: "Barba", duracion_min: 30, precio: 7000 },
  ]).select("id_servicio")).map((s) => s.id_servicio as number);
  ok(await admin.from("profesional_servicio").insert(
    pros.flatMap((id) => servicios.map((s) => ({ ...b, id_profesional: id, id_servicio: s })))));
  ok(await admin.from("horario_atencion").insert([1, 2, 3, 4, 5, 6].flatMap((dia) => [
    { ...b, id_profesional: barbero.id, id_sucursal: idSucursal, dia_semana: dia, hora_inicio: "10:00", hora_fin: "20:00" },
    { ...b, id_profesional: adm.id, id_sucursal: idSucursal, dia_semana: dia, hora_inicio: "10:00", hora_fin: "14:00" },
  ])));
  const productos = ok(await admin.from("producto").insert([
    { ...b, nombre: "Cera", categoria: "Pruebas", precio: 5000, stock: 100000 },
    { ...b, nombre: "Aceite", categoria: "Pruebas", precio: 12000, stock: 100000 },
  ]).select("id_producto")).map((p) => p.id_producto as number);
  const idGuest = (ok(await admin.from("guest_usuario").insert({
    ...b, nombre: "Invitado", apellido: "Prueba", correo: "invitado@pruebas.navaja.test",
  }).select("id_guest").single())).id_guest as string;

  // Reservas pasadas: validar_reserva no exige fecha futura (eso lo hace la RPC pública)
  const reservas = [];
  let i = 0;
  for (let d = 1; d <= DIAS; d++) {
    const dia = fecha(d);
    if (new Date(dia).getUTCDay() === 0) continue;
    for (const [pro, horas] of [[barbero.id, HORAS_BARBERO], [adm.id, HORAS_ADMIN]] as const) {
      for (const h of horas) {
        reservas.push({
          ...b, id_sucursal: idSucursal, id_profesional: pro, id_guest: idGuest, id_servicio: servicios[i % 2],
          fecha_hora_inicio: `${dia}T${String(h).padStart(2, "0")}:00:00Z`, estado: ESTADOS[i++ % ESTADOS.length],
        });
      }
    }
  }
  await enLotes("reserva", reservas);

  // Pedidos día por medio, pagados el mismo día (la fecha BI de un pedido es la de su primer pago aprobado)
  const dias = Array.from({ length: Math.floor(DIAS / 2) }, (_, k) => fecha(2 * k + 1));
  const pedidos = ok(await admin.from("pedido").insert(dias.map((dia) => ({
    ...b, id_sucursal: idSucursal, created_at: `${dia}T15:00:00Z`,
  }))).select("id_pedido, created_at")) as { id_pedido: number; created_at: string }[];
  ok(await admin.from("detalle_pedido").insert(pedidos.flatMap((p, k) => [
    { ...b, id_pedido: p.id_pedido, id_producto: productos[0], cantidad: 1 },
    ...(k % 2 ? [{ ...b, id_pedido: p.id_pedido, id_producto: productos[1], cantidad: 2 }] : []),
  ])));
  const totales = ok(await admin.from("pedido").select("id_pedido, monto_total, created_at").eq("id_barberia", idBarberia));
  await enLotes("pago", totales.map((p) => ({
    ...b, concepto: "pedido", id_pedido: p.id_pedido, monto: p.monto_total, proveedor: "efectivo",
    estado: "aprobado", id_transaccion_externa: `prueba-bi-${p.id_pedido}`, created_at: p.created_at,
  })));

  return { idBarberia, idSucursal, idModuloBi, planSinBi, planConBi, adm, barbero, cliente, superadmin, reservas: reservas.length };
}

/** Borra todo lo sembrado (los usuarios de prueba se conservan). Best-effort: avisa y sigue. */
export async function borrarBarberia(idBarberia: string) {
  const tablas = ["pago", "pedido", "reserva", "guest_usuario", "horario_atencion", "profesional_servicio",
    "profesional_sucursal", "profesional", "servicio", "producto", "suscripcion_modulo", "suscripcion",
    "usuario_barberia", "sucursal", "barberia"];
  for (const t of tablas) {
    const { error } = await admin.from(t).delete().eq("id_barberia", idBarberia);
    if (error) console.warn(`[pruebas] no se pudo limpiar ${t}: ${error.message}`);
  }
}
