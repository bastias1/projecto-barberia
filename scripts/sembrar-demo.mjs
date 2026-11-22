// Datos de demostración realistas (service role, pasa por los triggers: precios, totales y stock salen de la BD).
//   node scripts/sembrar-demo.mjs --confirmar [--solo <slug>]
// Cada barbería tiene su administrador demo (`dueno`); barberos y clientes demo también. Se crean con una clave
// al azar que se imprime una sola vez. Salta las barberías que ya existen (para repetir una: limpiar-datos.sql).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : (process.argv[i + 1] ?? true); };
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!arg("--confirmar")) {
  console.log(`Escribe datos de demostración en ${URL}.\nUso: node scripts/sembrar-demo.mjs --confirmar [--solo <slug>]`);
  process.exit(1);
}
const db = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = ({ data, error }, ctx = "") => { if (error) throw new Error(`${ctx}: ${error.message}`); return data; };
const VERSION = readFileSync("lib/plataforma.ts", "utf8").match(/VERSION_POLITICA\s*=\s*"([^"]+)"/)?.[1] ?? "demo";

// ---------- azar reproducible y fechas ----------
let semilla = 20261122;
const rnd = () => { semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pesos = (items, w) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < items.length; i++) if ((r -= w[i]) < 0) return items[i]; return items.at(-1); };
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const plano = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slugify = (s) => plano(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const TZ = "America/Santiago";
const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hoy = fmtFecha.format(new Date());
const sumaDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (f) => new Date(`${f}T12:00:00Z`).getUTCDay();
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** Fecha local + minutos desde medianoche → instante UTC (Chile cambia entre UTC-3 y UTC-4). */
const aUtc = (f, min) => {
  const [y, m, d] = f.split("-").map(Number);
  for (const off of [3, 4]) {
    const t = new Date(Date.UTC(y, m - 1, d, 0, min + off * 60));
    if (fmtFecha.format(t) === f && fmtHora.format(t) === hhmm(min)) return t.toISOString();
  }
  throw new Error(`hora inexistente ${f} ${min}`);
};
const lotes = async (tabla, filas, select, n = 500) => {
  const salida = [];
  for (let i = 0; i < filas.length; i += n) salida.push(...(ok(await db.from(tabla).insert(filas.slice(i, i + n)).select(select ?? "*"), tabla)));
  return salida;
};

// ---------- catálogos ----------
const H = ["Matías", "Benjamín", "Sebastián", "Diego", "Vicente", "Tomás", "Felipe", "Cristóbal", "Nicolás", "Javier", "Joaquín", "Ignacio", "Martín", "Camilo", "Rodrigo", "Andrés", "Gonzalo", "Pablo", "Esteban", "Lucas"];
const M = ["Camila", "Valentina", "Catalina", "Fernanda", "Constanza", "Javiera", "Francisca", "Antonia", "Daniela", "Carolina", "Macarena", "Paula"];
const AP = ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vera", "Fernández", "Gallardo", "Cortés", "Herrera", "Núñez", "Vidal", "Campos", "Vásquez", "Bravo", "Figueroa", "Riquelme", "Carrasco"];
const SERVICIOS = [
  ["Corte Clásico", "Corte a tijera o máquina, lavado y peinado.", 30, 12000, 30], ["Corte Degradado", "Fade o degradado a tu medida, con terminación a navaja.", 45, 15000, 28],
  ["Barba", "Perfilado y arreglo de barba con toalla caliente.", 30, 8000, 14], ["Corte + Barba", "El combo completo.", 60, 20000, 20],
  ["Perfilado de Cejas", "Perfilado rápido con navaja.", 15, 4000, 5], ["Coloración", "Mechas o coloración completa.", 90, 35000, 3],
];
const PRODUCTOS = [
  ["Cera Moldeadora Mate", "Peinado", 9990, "Fijación fuerte, acabado mate."], ["Pomada Base Agua", "Peinado", 11990, "Brillo medio, se lava fácil."],
  ["Aceite de Barba", "Barba", 12990, "Hidrata y suaviza. Aroma a cedro."], ["Bálsamo para Barba", "Barba", 10990, "Controla el frizz y da forma."],
  ["Shampoo Anticaspa", "Cuidado", 8990, "Uso diario, 250 ml."], ["Tónico Capilar", "Cuidado", 14990, "Fortalece el cuero cabelludo."],
  ["Peine de Madera", "Accesorios", 4990, "Peine para barba y cabello."], ["Navaja Clásica", "Accesorios", 24990, "Acero inoxidable con mango de madera."],
  ["Spray Texturizador", "Peinado", 9490, "Volumen y textura."],
];
const COMENTARIOS = {
  5: ["Excelente atención, quedé muy conforme con el corte.", "El mejor degradado que me han hecho, vuelvo seguro.", "Muy puntual y prolijo. Recomendado.", "Gran ambiente y muy buen trato.", "Impecable, salí como nuevo."],
  4: ["Muy buen corte, aunque tuve que esperar un poco.", "Buen servicio y buen precio.", "Quedó bien, volvería a atenderme."],
  3: ["El corte estuvo bien pero esperé más de lo acordado.", "Normal, nada especial."], 2: ["No quedó como lo pedí, tuve que corregirlo en casa."], 1: ["Llegué a la hora y me atendieron muy tarde."],
};
const FERIADOS = ["01-01", "05-01", "05-21", "06-21", "09-18", "09-19", "10-12", "11-01", "12-08", "12-25"];
const DOWF = [0, 0.72, 0.85, 0.92, 1.0, 1.3, 1.5];
const MES = [0, 0.92, 0.85, 1.0, 1.0, 1.02, 0.98, 0.95, 1.0, 1.08, 1.02, 1.05, 1.18];
const BLOQUES_L = [[600, 840], [900, 1200]], BLOQUES_C = [[600, 840], [900, 1140]], BLOQUES_T = [[660, 840], [900, 1200]];
const barbero = (n, a, alias, esp, dias, bloques, base, suc = 0) => ({ n, a, alias, esp, dias, bloques, base, suc });

const TIENDAS = [
  { slug: "benjvmin", dueno: ["Andrés", "Valenzuela"], nombre: "Barbería BENJVMIN", plan: 3, dias: 365, k: 1.0, rate: 1.3, ciudad: "Valdivia", region: "Los Ríos", tel: "+56 63 221 4455", ig: "benjvmin.barberia",
    eslogan: "Corte clásico, estilo propio", descripcion: "Barbería en el centro de Valdivia. Cortes clásicos y modernos, arreglo de barba y productos de cuidado.",
    sucursales: [["Centro", "Av. Picarte 1250", "Valdivia"]],
    barberos: [barbero("Benjamín", "Soto", "Benja", "Degradados y fade", [2, 3, 4, 5, 6], BLOQUES_L, 6.3), barbero("Matías", "Rojas", "Mati", "Barba y perfilado", [1, 2, 3, 4, 5], BLOQUES_C, 5.8), barbero("Diego", "Fuentes", "Diego", "Corte clásico", [3, 4, 5, 6], BLOQUES_T, 5.4)] },
  { slug: "barberia-los-rios", dueno: ["Carolina", "Espinoza"], nombre: "Barbería Los Ríos", plan: 2, dias: 430, k: 0.85, rate: 0.9, ciudad: "Valdivia", region: "Los Ríos", tel: "+56 63 224 1188", ig: "barberialosrios",
    eslogan: "Tradición en cada corte", descripcion: "Dos sucursales en Valdivia: Centro e Isla Teja. Atención sin hora previa los sábados.",
    sucursales: [["Centro", "Calle Arauco 640", "Valdivia"], ["Isla Teja", "Los Laureles 480", "Valdivia"]],
    barberos: [barbero("Cristóbal", "Vera", "Cris", "Corte clásico", [2, 3, 4, 5, 6], BLOQUES_L, 6.0, 0), barbero("Ana", "Muñoz", "Anita", "Degradados y color", [1, 2, 3, 4, 5, 6], BLOQUES_C, 5.6, 1)] },
  { slug: "corte-fino", dueno: ["Ignacio", "Herrera"], nombre: "Corte Fino", plan: 3, dias: 36, k: 0.8, rate: 0.7, ciudad: "Osorno", region: "Los Lagos", tel: "+56 64 223 7700", ig: "cortefino.osorno",
    eslogan: "Recién abiertos", descripcion: "Barbería nueva en Osorno. Corte, barba y cuidado masculino.",
    sucursales: [["Osorno Centro", "Av. Mackenna 1020", "Osorno"]],
    barberos: [barbero("Vicente", "Tapia", "Vicho", "Degradados", [2, 3, 4, 5, 6], BLOQUES_L, 5.2), barbero("Joaquín", "Bravo", "Joaco", "Barba", [3, 4, 5, 6], BLOQUES_T, 4.8)] },
  { slug: "navaja-dorada", dueno: ["Lucas", "Figueroa"], nombre: "Navaja Dorada", plan: 3, dias: 260, k: 0.9, rate: 0.8, ciudad: "Puerto Montt", region: "Los Lagos", tel: "+56 65 225 9034", ig: "navajadorada.pm",
    eslogan: "Afeitado clásico a navaja", descripcion: "Afeitado tradicional con toalla caliente y cortes de autor en Puerto Montt.",
    sucursales: [["Puerto Montt", "Av. Diego Portales 770", "Puerto Montt"]],
    barberos: [barbero("Gonzalo", "Núñez", "Gonza", "Afeitado a navaja", [2, 3, 4, 5, 6], BLOQUES_L, 6.0), barbero("Esteban", "Araya", "Este", "Corte clásico", [1, 2, 3, 4, 5], BLOQUES_C, 5.5)] },
  { slug: "los-pioneros", dueno: ["Macarena", "Castillo"], nombre: "Barbería Los Pioneros", plan: 1, dias: 190, k: 0.7, rate: 0, ciudad: "Temuco", region: "La Araucanía", tel: "+56 45 221 3321", ig: "lospioneros.temuco",
    eslogan: "Tu barbería de barrio", descripcion: "Cortes y barba en Temuco. Reserva tu hora en línea.",
    sucursales: [["Temuco Centro", "Calle Bulnes 455", "Temuco"]],
    barberos: [barbero("Rodrigo", "Pizarro", "Rodri", "Corte clásico", [2, 3, 4, 5, 6], BLOQUES_L, 5.6), barbero("Pablo", "Gallardo", "Pablito", "Degradados", [1, 3, 4, 5, 6], BLOQUES_C, 5.2)] },
];

// ---------- usuarios ----------
const CLAVE = `Demo-${Math.random().toString(36).slice(2, 8)}-${Math.floor(10 + Math.random() * 90)}`;
const telefono = () => `+569${Math.floor(1e7 + rnd() * 9e7)}`;
async function crearUsuario(nombre, apellido, sufijo = "") {
  const email = `${plano(nombre)}.${plano(apellido)}${sufijo}@demo.test`.replace(/[^a-z0-9.@]/g, "");
  const { data: previo } = await db.from("usuario").select("id_usuario").eq("email", email).maybeSingle();
  if (previo) return { id: previo.id_usuario, email };   // los clientes demo se reutilizan entre ejecuciones
  const { data, error } = await db.auth.admin.createUser({ email, password: CLAVE, email_confirm: true,
    user_metadata: { acepta_terminos: true, version_politica: VERSION, nombre, apellido } });
  if (error) throw new Error(`${email}: ${error.message}`);
  ok(await db.from("usuario").update({ nombre, apellido, telefono: telefono() }).eq("id_usuario", data.user.id), "usuario");
  return { id: data.user.id, email };
}

// ---------- una barbería ----------
async function sembrar(t, ctx) {
  const inicio = sumaDias(hoy, -t.dias);
  const prog = (i) => Math.min(1, Math.max(0, (i + t.dias) / t.dias));
  const b = { id_barberia: ok(await db.from("barberia").insert({
    nombre: t.nombre, slug: t.slug, telefono: t.tel, email_contacto: `contacto@${t.slug}.demo.test`, instagram: t.ig, eslogan: t.eslogan, descripcion: t.descripcion,
  }).select("id_barberia").single(), "barberia").id_barberia };

  const prueba = t.slug === "corte-fino";
  const precioPlan = ctx.planes[t.plan];
  const sus = ok(await db.from("suscripcion").insert({ ...b, id_plan: t.plan, precio_pactado: precioPlan, estado: prueba ? "prueba" : "activa",
    fecha_inicio: inicio, fecha_termino: sumaDias(hoy, prueba ? 9 : 5 + Math.floor(rnd() * 20)) }).select("id_suscripcion").single(), "suscripcion");
  if (!prueba) {
    const meses = Math.floor(t.dias / 30);
    await lotes("pago", Array.from({ length: meses }, (_, m) => ({ ...b, concepto: "suscripcion", id_suscripcion: sus.id_suscripcion, monto: precioPlan,
      proveedor: "mercadopago", estado: "aprobado", id_transaccion_externa: `demo-sub-${t.slug}-${m}`, created_at: aUtc(sumaDias(inicio, 30 * m), 540) })));
  }

  const sucIds = (await lotes("sucursal", t.sucursales.map(([nombre, direccion, comuna]) => ({ ...b, nombre, direccion, comuna, region: t.region, telefono: t.tel, slug: slugify(nombre) })), "id_sucursal"))
    .map((s) => s.id_sucursal);
  const dueno = await crearUsuario(...t.dueno);
  ok(await db.from("usuario_barberia").insert({ ...b, id_usuario: dueno.id, rol: "admin" }), "admin");

  const barberos = [];
  for (const x of t.barberos) barberos.push({ ...x, id: (await crearUsuario(x.n, x.a)).id });
  ok(await db.from("usuario_barberia").insert(barberos.map((x) => ({ ...b, id_usuario: x.id, rol: "profesional" }))), "equipo");
  await lotes("profesional", barberos.map((x) => ({ ...b, id_profesional: x.id, alias: x.alias, especialidad: x.esp })));
  await lotes("profesional_sucursal", barberos.map((x) => ({ ...b, id_profesional: x.id, id_sucursal: sucIds[x.suc] })));
  const servicios = (await lotes("servicio", SERVICIOS.map(([nombre, descripcion, duracion_min, precio]) => ({
    ...b, nombre, descripcion, duracion_min, precio: Math.round((precio * (0.9 + 0.05 * (t.plan % 3))) / 500) * 500 })), "id_servicio")).map((s, i) => ({ id: s.id_servicio, dur: SERVICIOS[i][2], w: SERVICIOS[i][4] }));
  await lotes("profesional_servicio", barberos.flatMap((x) => servicios.map((s) => ({ ...b, id_profesional: x.id, id_servicio: s.id }))));
  await lotes("horario_atencion", barberos.flatMap((x) => x.dias.flatMap((d) => x.bloques.map(([a, z]) => ({
    ...b, id_profesional: x.id, id_sucursal: sucIds[x.suc], dia_semana: d, hora_inicio: hhmm(a), hora_fin: hhmm(z) })))));

  // clientes invitados y cuentas demo que ya reservan aquí
  const guests = [];
  const vistos = new Set();
  while (guests.length < (t.dias > 100 ? 70 : 30)) {
    const n = pick(rnd() < 0.5 ? H : M), a = pick(AP), correo = `${plano(n)}.${plano(a)}${guests.length}@demo.test`.replace(/[^a-z0-9.@]/g, "");
    if (vistos.has(correo)) continue; vistos.add(correo);
    guests.push({ ...b, nombre: n, apellido: a, correo, telefono: telefono() });
  }
  const guestIds = (await lotes("guest_usuario", guests, "id_guest")).map((g) => g.id_guest);

  // ---- reservas ----
  const filas = [];
  for (let i = -t.dias; i <= 14; i++) {
    const f = sumaDias(hoy, i), futuro = i >= 0;
    if (FERIADOS.includes(f.slice(5))) continue;
    for (const x of barberos) {
      if (!x.dias.includes(dow(f))) continue;
      const lambda = x.base * t.k * DOWF[dow(f)] * MES[Number(f.slice(5, 7))] * (0.78 + 0.27 * prog(i));
      let n = Math.max(0, Math.round(lambda * (1 + 0.1 * gauss())));
      if (futuro) n = Math.round(n * 0.4);
      const ocupado = [];
      for (let k = 0; k < n; k++) {
        const s = pesos(servicios, servicios.map((v) => v.w));
        for (let intento = 0; intento < 25; intento++) {
          const [a, z] = pesos(x.bloques, x.bloques.map(([p, q]) => q - p));
          const slots = Math.floor((z - a - s.dur) / 15) + 1;
          if (slots < 1) continue;
          const ini = a + 15 * Math.floor(rnd() * slots);
          if (ocupado.some(([p, q]) => ini < q && ini + s.dur > p)) continue;
          ocupado.push([ini, ini + s.dur]);
          const registrado = rnd() < 0.2 && ctx.clientes.length;
          const inicioUtc = aUtc(f, ini);
          filas.push({ ...b, id_sucursal: sucIds[x.suc], id_profesional: x.id, id_servicio: s.id, fecha_hora_inicio: inicioUtc,
            estado: futuro ? pesos(["confirmada", "pendiente"], [55, 45]) : pesos(["completada", "cancelada", "no_asistio"], [84, 9, 7]),
            ...(registrado ? { id_cliente: ctx.clientes[Math.floor(ctx.clientes.length * rnd() ** 1.8)] } : { id_guest: guestIds[Math.floor(guestIds.length * rnd() ** 1.8)] }),
            created_at: new Date(Date.parse(inicioUtc) - (3_600_000 + rnd() * 4 * 86_400_000)).toISOString() });
          break;
        }
      }
    }
  }
  const reservas = await lotes("reserva", filas, "id_reserva, estado, id_cliente, id_guest, id_profesional, id_servicio, fecha_hora_inicio");

  const ahora = Date.now();
  const resenas = reservas.filter((r) => r.estado === "completada" && rnd() < 0.3).map((r) => {
    const cal = pesos([5, 4, 3, 2, 1], [55, 28, 9, 4, 4]);
    return { ...b, id_reserva: r.id_reserva, id_profesional: r.id_profesional, id_servicio: r.id_servicio, calificacion: cal,
      ...(r.id_cliente ? { id_cliente: r.id_cliente } : { id_guest: r.id_guest }), comentario: rnd() < 0.6 ? pick(COMENTARIOS[cal]) : null,
      created_at: new Date(Math.min(ahora, Date.parse(r.fecha_hora_inicio) + (1 + rnd() * 2) * 86_400_000)).toISOString() };
  });
  await lotes("resena", resenas);

  // ---- tienda (solo planes con ecommerce) ----
  let pedidos = 0;
  if (t.rate > 0) {
    const productos = (await lotes("producto", PRODUCTOS.map(([nombre, categoria, precio, descripcion]) => ({
      ...b, nombre, categoria, descripcion, precio, stock: 400 + Math.floor(rnd() * 400), stock_minimo: 15 })), "id_producto, precio")).map((p) => ({ id: p.id_producto, precio: Number(p.precio) }));
    const cabeceras = [], lineas = [];
    for (let i = -t.dias; i < 0; i++) {
      const f = sumaDias(hoy, i);
      if (dow(f) === 0 || FERIADOS.includes(f.slice(5))) continue;
      const n = Math.max(0, Math.round(t.rate * DOWF[dow(f)] * (0.8 + 0.25 * prog(i)) * (1 + 0.2 * gauss())));
      for (let k = 0; k < n; k++) {
        const cliente = rnd() < 0.3 && ctx.clientes.length ? pick(ctx.clientes) : null, despacho = cliente && rnd() < 0.2;
        const elegidos = [...productos].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 3));
        cabeceras.push({ ...b, id_sucursal: sucIds[0], id_cliente: cliente, tipo_entrega: despacho ? "despacho" : "retiro",
          ...(despacho ? { direccion_envio: `${pick(["Av. Alemania", "Calle Yungay", "Los Alerces", "Av. Ramón Picarte"])} ${100 + Math.floor(rnd() * 900)}, ${t.ciudad}` } : {}),
          created_at: aUtc(f, 600 + Math.floor(rnd() * 600)) });
        lineas.push(elegidos.map((p) => ({ id_producto: p.id, cantidad: pesos([1, 2], [75, 25]), precio: p.precio })));
      }
    }
    const creados = await lotes("pedido", cabeceras, "id_pedido, created_at");
    await lotes("detalle_pedido", creados.flatMap((p, i) => lineas[i].map((l) => ({ ...b, id_pedido: p.id_pedido, id_producto: l.id_producto, cantidad: l.cantidad }))));
    const prov = () => pesos(["mercadopago", "efectivo", "transferencia"], [60, 25, 15]);
    const pago = (p, i, estado, extra = {}) => ({ ...b, concepto: "pedido", id_pedido: p.id_pedido, proveedor: extra.prov ?? "mercadopago", estado,
      monto: lineas[i].reduce((s, l) => s + l.precio * l.cantidad, 0), id_transaccion_externa: `ORD${t.slug.slice(0, 3).toUpperCase()}${p.id_pedido}${estado[0]}`,
      created_at: new Date(Date.parse(p.created_at) + extra.min * 60_000).toISOString() });
    await lotes("pago", creados.flatMap((p, i) => (rnd() < 0.04 ? [pago(p, i, "rechazado", { prov: "mercadopago", min: 1 })] : [])));
    await lotes("pago", creados.map((p, i) => { const pr = prov(); return pago(p, i, "aprobado", { prov: pr, min: pr === "mercadopago" ? 3 : 20 }); }));
    // estados: lo viejo entregado; lo reciente en preparación
    const grupos = { entregado: [], listo_retiro: [], enviado: [] };
    creados.forEach((p, i) => {
      const dias = (ahora - Date.parse(p.created_at)) / 86_400_000;
      if (dias > 5) grupos.entregado.push(p.id_pedido);
      else if (dias > 1 && rnd() < 0.7) (cabeceras[i].tipo_entrega === "despacho" ? grupos.enviado : grupos.listo_retiro).push(p.id_pedido);
    });
    for (const [estado, ids] of Object.entries(grupos)) for (let i = 0; i < ids.length; i += 200)
      ok(await db.from("pedido").update({ estado }).eq("id_barberia", b.id_barberia).in("id_pedido", ids.slice(i, i + 200)), "estado pedido");
    // dos productos bajo el stock mínimo para ver la alerta
    for (const p of productos.slice(0, 2)) ok(await db.from("producto").update({ stock: 4 }).eq("id_barberia", b.id_barberia).eq("id_producto", p.id), "stock bajo");
    pedidos = creados.length;
  }

  // vacaciones futuras (después de las reservas sembradas)
  await lotes("dia_bloqueado", barberos.slice(0, 2).map((x, i) => ({ ...b, id_profesional: x.id, fecha: sumaDias(hoy, 16 + i * 3), motivo: "Vacaciones" })));

  console.log(`${t.nombre}: ${reservas.length} reservas, ${resenas.length} reseñas, ${pedidos} pedidos`);
  return [`ADMIN ${t.dueno.join(" ")} (${t.nombre}): ${dueno.email}`, ...barberos.map((x) => `${x.n} ${x.a} (${t.nombre}): ${plano(x.n)}.${plano(x.a)}@demo.test`)];
}

// ---------- ejecución ----------
const { data: existentes } = await db.from("barberia").select("slug");
const tiendas = TIENDAS.filter((t) => (!arg("--solo") || t.slug === arg("--solo")) && !existentes.some((e) => e.slug === t.slug));
if (!tiendas.length) throw new Error("Nada que sembrar: esas barberías ya existen (para repetir, limpia la base).");
const planes = Object.fromEntries(ok(await db.from("plan_suscripcion").select("id_plan, precio_mensual"), "planes").map((p) => [p.id_plan, Number(p.precio_mensual)]));

const clientes = [];
for (let i = 0; i < 14; i++) clientes.push((await crearUsuario(i % 2 ? pick(M) : pick(H), AP[(i * 3) % AP.length], String(i))).id);
const cuentas = [];
for (const t of tiendas) cuentas.push(...await sembrar(t, { clientes, planes }));
console.log(`\nClave de todas las cuentas demo: ${CLAVE}\n${cuentas.join("\n")}`);
