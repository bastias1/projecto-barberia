import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaById, getBarberiaBySlug, DEFAULT_TZ } from "./barberia";
import { PLATAFORMA } from "./plataforma";
import { formatCLP, formatFecha, toZoned } from "./datetime";
import { emailButton, emailDetalle, emailLayout, escapeHtml, sendEmail } from "./email";
import { bookingActionUrl, getSiteUrl, reprogramarUrl, reviewUrl } from "./signed-links";
import { one } from "./utils";

/*
 * Correos transaccionales. Se leen los datos con service role porque quien
 * dispara el correo (un invitado sin sesión o un barbero) no siempre puede ver
 * el contacto del destinatario por RLS. Solo se usan en el servidor.
 */

interface Contacto {
  nombre: string;
  correo: string;
}

async function cargarReserva(idReserva: number) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("reserva")
    .select(`
      id_reserva, id_barberia, estado, fecha_hora_inicio, monto,
      servicio:servicio!reserva_servicio_fkey (nombre),
      sucursal:sucursal!reserva_sucursal_fkey (nombre, direccion, comuna, zona_horaria),
      profesional:profesional!reserva_profesional_fkey (alias, usuario:usuario!profesional_usuario_fkey (nombre, apellido)),
      guest:guest_usuario!reserva_guest_fkey (nombre, correo),
      cliente:usuario!reserva_cliente_fkey (nombre, email)
    `)
    .eq("id_reserva", idReserva)
    .single();

  if (error || !data) {
    console.error(`[notificaciones] No se pudo cargar la reserva ${idReserva}:`, error);
    return null;
  }

  const guest = one<{ nombre: string; correo: string }>(data.guest);
  const cliente = one<{ nombre: string; email: string }>(data.cliente);
  const contacto: Contacto | null = guest
    ? { nombre: guest.nombre, correo: guest.correo }
    : cliente
      ? { nombre: cliente.nombre, correo: cliente.email }
      : null;

  const profesional = one<{ alias: string | null; usuario: unknown }>(data.profesional);
  const usuarioProf = one<{ nombre: string; apellido: string | null }>(profesional?.usuario);
  const sucursal = one<{ nombre: string; direccion: string; comuna: string; zona_horaria: string }>(data.sucursal);
  const { fecha, hora } = toZoned(data.fecha_hora_inicio, sucursal?.zona_horaria || DEFAULT_TZ);

  const barberia = await getBarberiaById(supabase, data.id_barberia);
  if (!barberia) return null;

  return {
    supabase,
    barberia,
    reserva: data,
    contacto,
    servicio: one<{ nombre: string }>(data.servicio)?.nombre ?? "Servicio",
    barbero: profesional?.alias || [usuarioProf?.nombre, usuarioProf?.apellido].filter(Boolean).join(" ") || "Barbero",
    sucursal,
    fecha,
    hora,
  };
}

/** Correo con los links de confirmar/cancelar, al crear una reserva. */
export async function notificarReservaCreada(idReserva: number): Promise<void> {
  const info = await cargarReserva(idReserva);
  if (!info?.contacto) return;

  const { barberia } = info;
  const confirmar = bookingActionUrl("confirm", idReserva);
  const cancelar = bookingActionUrl("cancel", idReserva);

  const html = emailLayout(
    "Recibimos tu reserva",
    `<p style="margin:0 0 16px">Hola ${escapeHtml(info.contacto.nombre)}, estos son los datos de tu cita:</p>
     ${emailDetalle([
       ["Servicio", info.servicio],
       ["Barbero", info.barbero],
       ["Fecha", formatFecha(info.fecha, "EEEE d 'de' MMMM")],
       ["Hora", info.hora],
       ...(info.sucursal ? [["Sucursal", `${info.sucursal.nombre} · ${info.sucursal.direccion}`] as [string, string]] : []),
       ["Total", formatCLP(info.reserva.monto)],
     ])}
     <p style="margin:0 0 12px">Por favor confirma tu asistencia:</p>
     <p style="margin:0">${emailButton(confirmar, "Confirmar cita", "#16a34a")}${emailButton(reprogramarUrl(barberia.slug, idReserva), "Cambiar la hora")}${emailButton(cancelar, "Cancelar cita", "#dc2626")}</p>`,
    barberia.nombre,
  );

  const enviado = await sendEmail({ to: info.contacto.correo, subject: `Tu reserva en ${barberia.nombre}`, html, fromName: barberia.nombre, replyTo: barberia.email_contacto });
  if (!enviado) console.info(`[notificaciones] Links reserva ${idReserva}: confirmar=${confirmar} cancelar=${cancelar}`);
}

/** HU-22: aviso al cliente de que su cita se canceló o cambió de hora. */
export async function notificarCambioReserva(idReserva: number, cambio: "cancelada" | "reprogramada"): Promise<void> {
  const info = await cargarReserva(idReserva);
  if (!info?.contacto) return;

  const { barberia } = info;
  const cancelada = cambio === "cancelada";
  const html = emailLayout(
    cancelada ? "Tu cita fue cancelada" : "Tu cita cambió de hora",
    `<p style="margin:0 0 16px">Hola ${escapeHtml(info.contacto.nombre)}, ${cancelada ? "cancelamos esta cita y el horario quedó libre:" : "estos son los nuevos datos de tu cita:"}</p>
     ${emailDetalle([
       ["Servicio", info.servicio],
       ["Barbero", info.barbero],
       ["Fecha", formatFecha(info.fecha, "EEEE d 'de' MMMM")],
       ["Hora", info.hora],
       ...(info.sucursal ? [["Sucursal", `${info.sucursal.nombre} · ${info.sucursal.direccion}`] as [string, string]] : []),
     ])}
     <p style="margin:0">${cancelada
       ? emailButton(`${getSiteUrl()}/${barberia.slug}/agendar`, "Agendar otra cita")
       : emailButton(reprogramarUrl(barberia.slug, idReserva), "Cambiar la hora") + emailButton(bookingActionUrl("cancel", idReserva), "Cancelar cita", "#dc2626")}</p>`,
    barberia.nombre,
  );

  await sendEmail({
    to: info.contacto.correo,
    subject: cancelada ? `Cita cancelada en ${barberia.nombre}` : `Nueva hora para tu cita en ${barberia.nombre}`,
    html,
    fromName: barberia.nombre,
    replyTo: barberia.email_contacto,
  });
}

/** Correo con el link de reseña, cuando una reserva se marca como completada. */
export async function notificarResenaReserva(idReserva: number): Promise<void> {
  const info = await cargarReserva(idReserva);
  if (!info?.contacto || info.reserva.estado !== "completada") return;

  const { count } = await info.supabase
    .from("resena")
    .select("id_resena", { count: "exact", head: true })
    .eq("id_reserva", idReserva);
  if (count) return; // ya opinó

  const { barberia } = info;
  const link = reviewUrl("reserva", idReserva);

  const html = emailLayout(
    "¿Cómo te fue con tu corte?",
    `<p style="margin:0 0 16px">Hola ${escapeHtml(info.contacto.nombre)}, gracias por visitarnos.
     Nos encantaría saber qué te pareció tu ${escapeHtml(info.servicio.toLowerCase())} con ${escapeHtml(info.barbero)}
     del ${escapeHtml(formatFecha(info.fecha, "d 'de' MMMM"))}.</p>
     <p style="margin:0">${emailButton(link, "Dejar mi reseña")}</p>`,
    barberia.nombre,
  );

  const enviado = await sendEmail({ to: info.contacto.correo, subject: `¿Qué te pareció tu visita a ${barberia.nombre}?`, html, fromName: barberia.nombre, replyTo: barberia.email_contacto });
  if (!enviado) console.info(`[notificaciones] Link reseña reserva ${idReserva}: ${link}`);
}

/** Correo con el link de reseña, cuando un pedido se marca como entregado. */
export async function notificarResenaPedido(idPedido: number): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: pedido, error } = await supabase
    .from("pedido")
    .select(`
      id_pedido, id_barberia, estado, id_cliente,
      cliente:usuario!pedido_cliente_fkey (nombre, email),
      detalle_pedido!detalle_pedido_pedido_fkey (id_producto, producto:producto!detalle_pedido_producto_fkey (nombre))
    `)
    .eq("id_pedido", idPedido)
    .single();

  if (error || !pedido) {
    console.error(`[notificaciones] No se pudo cargar el pedido ${idPedido}:`, error);
    return;
  }

  const cliente = one<{ nombre: string; email: string }>(pedido.cliente);
  if (!cliente || pedido.estado !== "entregado") return;

  const detalles = (pedido.detalle_pedido ?? []) as Array<{ id_producto: number; producto: unknown }>;
  const { data: yaResenados } = await supabase
    .from("resena")
    .select("id_producto")
    .eq("id_cliente", pedido.id_cliente)
    .in("id_producto", detalles.map((d) => d.id_producto));
  const resenados = new Set((yaResenados ?? []).map((r) => r.id_producto));
  const pendientes = detalles.filter((d) => !resenados.has(d.id_producto));
  if (pendientes.length === 0) return;

  const barberia = await getBarberiaById(supabase, pedido.id_barberia);
  if (!barberia) return;
  const link = reviewUrl("pedido", idPedido);
  const lista = pendientes
    .map((d) => `<li style="margin:4px 0">${escapeHtml(one<{ nombre: string }>(d.producto)?.nombre)}</li>`)
    .join("");

  const html = emailLayout(
    "¿Qué te parecieron tus productos?",
    `<p style="margin:0 0 12px">Hola ${escapeHtml(cliente.nombre)}, tu pedido #${idPedido} ya fue entregado.
     Cuéntanos qué te parecieron:</p>
     <ul style="margin:0 0 20px;padding-left:20px">${lista}</ul>
     <p style="margin:0">${emailButton(link, "Calificar productos")}</p>`,
    barberia.nombre,
  );

  const enviado = await sendEmail({ to: cliente.email, subject: `Califica tu pedido #${idPedido}`, html, fromName: barberia.nombre, replyTo: barberia.email_contacto });
  if (!enviado) console.info(`[notificaciones] Link reseña pedido ${idPedido}: ${link}`);
}

/**
 * HU-09: avisa a los administradores de los productos que quedaron en o bajo su stock mínimo.
 * `reclamar_alertas_stock` marca cada producto, así llega un solo correo por baja aunque el pago
 * se registre dos veces (respuesta síncrona + webhook).
 */
export async function notificarStockBajo(idBarberia: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: productos, error } = await supabase.rpc("reclamar_alertas_stock", { p_barberia: idBarberia });
  if (error) console.error("[notificaciones] Error en reclamar_alertas_stock:", error);
  const bajos = (productos ?? []) as Array<{ nombre: string; stock: number; stock_minimo: number }>;
  if (bajos.length === 0) return;

  const barberia = await getBarberiaById(supabase, idBarberia);
  if (!barberia) return;
  const correos = await correosAdmins(supabase, idBarberia);

  const html = emailLayout(
    "Productos con stock bajo",
    `<p style="margin:0 0 16px">Estos productos llegaron a su stock mínimo:</p>
     ${emailDetalle(bajos.map((p) => [p.nombre, `quedan ${p.stock} (mínimo ${p.stock_minimo})`]))}
     <p style="margin:0">${emailButton(`${getSiteUrl()}/${barberia.slug}/dashboard/productos`, "Ver productos")}</p>`,
    barberia.nombre,
  );
  for (const to of correos) {
    await sendEmail({ to, subject: `Stock bajo en ${barberia.nombre}`, html, fromName: barberia.nombre });
  }
}

/** Correos de los administradores activos de una barbería. */
async function correosAdmins(supabase: ReturnType<typeof createServiceRoleClient>, idBarberia: string): Promise<string[]> {
  const { data: admins } = await supabase.from("usuario_barberia").select("id_usuario").eq("id_barberia", idBarberia).eq("rol", "admin").eq("activo", true);
  const { data: usuarios } = await supabase
    .from("usuario")
    .select("email")
    .in("id_usuario", (admins ?? []).map((a) => a.id_usuario))
    .is("deleted_at", null);
  return (usuarios ?? []).map((u) => u.email);
}

async function cargarPedido(idPedido: number) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pedido")
    .select(`
      id_pedido, id_barberia, monto_total, tipo_entrega, direccion_envio,
      cliente:usuario!pedido_cliente_fkey (nombre, email),
      detalle_pedido!detalle_pedido_pedido_fkey (cantidad, precio_unitario, producto:producto!detalle_pedido_producto_fkey (nombre))
    `)
    .eq("id_pedido", idPedido)
    .single();
  if (error || !data) {
    console.error(`[notificaciones] No se pudo cargar el pedido ${idPedido}:`, error);
    return null;
  }
  const cliente = one<{ nombre: string; email: string }>(data.cliente);
  const barberia = await getBarberiaById(supabase, data.id_barberia);
  return cliente && barberia ? { pedido: data, cliente, barberia } : null; // sin cliente = venta presencial
}

/** Comprobante al comprador cuando se aprueba el pago de un pedido. */
export async function notificarPedidoPagado(idPedido: number): Promise<void> {
  const info = await cargarPedido(idPedido);
  if (!info) return;
  const { pedido, cliente, barberia } = info;
  const detalles = (pedido.detalle_pedido ?? []) as Array<{ cantidad: number; precio_unitario: number; producto: unknown }>;

  const html = emailLayout(
    "Recibimos tu pago",
    `<p style="margin:0 0 16px">Hola ${escapeHtml(cliente.nombre)}, tu pedido #${idPedido} fue pagado correctamente:</p>
     ${emailDetalle([
       ...detalles.map((d) => [`${d.cantidad} × ${one<{ nombre: string }>(d.producto)?.nombre ?? "Producto"}`, formatCLP(d.cantidad * d.precio_unitario)] as [string, string]),
       ["Entrega", pedido.tipo_entrega === "despacho" ? `Despacho a ${pedido.direccion_envio}` : "Retiro en la barbería"],
       ["Total", formatCLP(pedido.monto_total)],
     ])}
     <p style="margin:0">Te avisaremos cuando esté listo.</p>`,
    barberia.nombre,
  );
  await sendEmail({ to: cliente.email, subject: `Pago recibido · pedido #${idPedido}`, html, fromName: barberia.nombre, replyTo: barberia.email_contacto });
}

/** Aviso al comprador cuando el pedido queda listo para retirar o sale en camino. */
export async function notificarEstadoPedido(idPedido: number, estado: "listo_retiro" | "enviado"): Promise<void> {
  const info = await cargarPedido(idPedido);
  if (!info) return;
  const { cliente, barberia } = info;
  const listo = estado === "listo_retiro";

  const html = emailLayout(
    listo ? "Tu pedido está listo para retirar" : "Tu pedido va en camino",
    `<p style="margin:0">Hola ${escapeHtml(cliente.nombre)}, tu pedido #${idPedido} ${listo ? "ya puedes retirarlo en la barbería." : "fue enviado a tu dirección."}</p>`,
    barberia.nombre,
  );
  await sendEmail({ to: cliente.email, subject: listo ? `Tu pedido #${idPedido} está listo` : `Tu pedido #${idPedido} va en camino`, html, fromName: barberia.nombre, replyTo: barberia.email_contacto });
}

const AVISOS_SUSCRIPCION = {
  cobro_rechazado: { titulo: "No pudimos cobrar tu suscripción", texto: "El último cobro de tu suscripción fue rechazado. Actualiza tu tarjeta para no perder el acceso.", boton: "Revisar suscripción" },
  cancelada: { titulo: "Tu suscripción fue cancelada", texto: "No se harán más cobros. Mantienes el acceso hasta que termine el período ya pagado.", boton: "Ver suscripción" },
  por_vencer: { titulo: "Tu plan está por vencer", texto: "Tu período termina en pocos días. Elige un plan para seguir recibiendo reservas sin interrupciones.", boton: "Elegir plan" },
  vencida: { titulo: "Tu plan venció", texto: "La reserva online y el resto de los módulos están pausados. Reactiva tu plan para retomarlos.", boton: "Reactivar plan" },
} as const;
export type AvisoSuscripcion = keyof typeof AVISOS_SUSCRIPCION;

/** Avisa a los administradores de un cambio en la suscripción de su barbería. Devuelve si se envió algo. */
export async function notificarSuscripcion(idBarberia: string, aviso: AvisoSuscripcion): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const barberia = await getBarberiaById(supabase, idBarberia);
  if (!barberia) return false;
  const a = AVISOS_SUSCRIPCION[aviso];
  const html = emailLayout(
    a.titulo,
    `<p style="margin:0 0 16px">${escapeHtml(a.texto)}</p><p style="margin:0">${emailButton(`${getSiteUrl()}/${barberia.slug}/dashboard/suscripcion`, a.boton)}</p>`,
    barberia.nombre,
  );
  let enviado = false;
  for (const to of await correosAdmins(supabase, idBarberia)) {
    enviado = (await sendEmail({ to, subject: `${a.titulo} · ${barberia.nombre}`, html, fromName: PLATAFORMA.nombre, replyTo: PLATAFORMA.emailContacto })) || enviado;
  }
  return enviado;
}

/**
 * Avisos de vencimiento (job diario): 3 días antes si no hay renovación automática, y una vez vencida.
 * `suscripcion.aviso_enviado` = "<aviso>:<fecha_termino>" evita repetirlos; al extenderse la fecha vuelve a avisar.
 * shortcut: fechas en UTC (puede adelantarse un día respecto de Chile).
 */
export async function notificarVencimientos(): Promise<number> {
  const supabase = createServiceRoleClient();
  const dia = (dias: number) => new Date(Date.now() + dias * 86400_000).toISOString().slice(0, 10);
  const hoy = dia(0);
  const { data: filas, error } = await supabase
    .from("suscripcion")
    .select("id_suscripcion, id_barberia, estado, fecha_termino, id_suscripcion_externa, aviso_enviado")
    .in("estado", ["prueba", "activa"])
    .gte("fecha_termino", dia(-3)) // las vencidas hace más tiempo no se avisan
    .lte("fecha_termino", dia(3));
  if (error) {
    console.error("[notificaciones] Error leyendo vencimientos:", error);
    return 0;
  }

  let enviados = 0;
  for (const s of filas ?? []) {
    const aviso: AvisoSuscripcion | null = s.fecha_termino! < hoy ? "vencida" : s.id_suscripcion_externa ? null : "por_vencer";
    const clave = `${aviso}:${s.fecha_termino}`;
    if (!aviso || s.aviso_enviado === clave) continue;
    // Reclamo condicional: un solo job gana aunque se solapen
    const base = supabase.from("suscripcion").update({ aviso_enviado: clave }).eq("id_suscripcion", s.id_suscripcion);
    const { data: reclamada } = await (s.aviso_enviado === null ? base.is("aviso_enviado", null) : base.eq("aviso_enviado", s.aviso_enviado)).select("id_suscripcion");
    if (!reclamada?.length) continue;
    if (await notificarSuscripcion(s.id_barberia, aviso)) enviados++;
    else await supabase.from("suscripcion").update({ aviso_enviado: null }).eq("id_suscripcion", s.id_suscripcion);
  }
  return enviados;
}

/** Confirmación al dueño que registra una barbería (prueba de 14 días). */
export async function notificarBarberiaRegistrada(correo: string, nombre: string, slug: string): Promise<void> {
  const base = `${getSiteUrl()}/${slug}`;
  const html = emailLayout(
    `${nombre} ya está en ${PLATAFORMA.nombre}`,
    `<p style="margin:0 0 16px">Tu barbería quedó registrada con 14 días de prueba. Para empezar:</p>
     <ol style="margin:0 0 20px;padding-left:20px"><li>Agrega tus servicios y barberos.</li><li>Define tus horarios de atención.</li><li>Comparte tu página: ${escapeHtml(base)}</li></ol>
     <p style="margin:0">${emailButton(`${base}/dashboard`, "Ir a mi panel")}</p>`,
    PLATAFORMA.nombre,
  );
  await sendEmail({ to: correo, subject: `Tu barbería ${nombre} está lista`, html, fromName: PLATAFORMA.nombre, replyTo: PLATAFORMA.emailContacto });
}

/** Al administrador que invitó: la persona aceptó. Solo si aceptó hace un momento y la sesión es la del invitado. */
export async function notificarInvitacionAceptada(token: string, correoSesion: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: inv } = await supabase
    .from("invitacion")
    .select("id_barberia, correo, rol, estado, respondida_at, invitado_por")
    .eq("token", token)
    .maybeSingle();
  // shortcut: ventana de 2 min en vez de una marca por invitación; evita reenvíos al repetir la llamada
  if (!inv || inv.estado !== "aceptada" || !inv.invitado_por || inv.correo !== correoSesion.toLowerCase()) return;
  if (!inv.respondida_at || Date.now() - new Date(inv.respondida_at).getTime() > 120_000) return;

  const [barberia, { data: quien }] = await Promise.all([
    getBarberiaById(supabase, inv.id_barberia),
    supabase.from("usuario").select("email").eq("id_usuario", inv.invitado_por).is("deleted_at", null).maybeSingle(),
  ]);
  if (!barberia || !quien) return;
  const html = emailLayout(
    "Aceptaron tu invitación",
    `<p style="margin:0 0 16px">${escapeHtml(inv.correo)} ya es parte del equipo de <strong>${escapeHtml(barberia.nombre)}</strong> como ${inv.rol === "admin" ? "administrador" : "barbero"}.</p>
     <p style="margin:0">${emailButton(`${getSiteUrl()}/${barberia.slug}/dashboard/usuarios`, "Ver equipo")}</p>`,
    barberia.nombre,
  );
  await sendEmail({ to: quien.email, subject: `${inv.correo} aceptó unirse a ${barberia.nombre}`, html, fromName: PLATAFORMA.nombre, replyTo: PLATAFORMA.emailContacto });
}

/** Aviso de seguridad al correo actual de la cuenta: cambio de contraseña o solicitud de nuevo correo. */
export async function notificarSeguridad(correo: string, cambio: "clave" | "correo", nuevoCorreo?: string): Promise<void> {
  const html = emailLayout(
    cambio === "clave" ? "Cambiaste tu contraseña" : "Pediste cambiar tu correo",
    `<p style="margin:0">${cambio === "clave"
      ? "La contraseña de tu cuenta se acaba de cambiar."
      : `Se pidió cambiar el correo de tu cuenta a <strong>${escapeHtml(nuevoCorreo)}</strong>.`}
     Si no fuiste tú, recupera tu cuenta desde "¿Olvidaste tu contraseña?" y escríbenos a ${escapeHtml(PLATAFORMA.emailContacto)}.</p>`,
    PLATAFORMA.nombre,
  );
  await sendEmail({ to: correo, subject: cambio === "clave" ? "Tu contraseña fue cambiada" : "Solicitud de cambio de correo", html, fromName: PLATAFORMA.nombre, replyTo: PLATAFORMA.emailContacto });
}

/**
 * Bienvenida a una cuenta nueva (email al confirmar, Google al aceptar términos). Una sola vez:
 * `app_metadata.bienvenida_enviada`. shortcut: solo cuentas de menos de 7 días (las anteriores a esta
 * función no la reciben); subir si se acepta confirmar el correo más tarde.
 */
export async function notificarBienvenida(
  user: { id: string; email?: string; created_at: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  slug?: string | null,
): Promise<void> {
  if (!user.email || user.app_metadata?.bienvenida_enviada) return;
  if (Date.now() - new Date(user.created_at).getTime() > 7 * 24 * 3600 * 1000) return;

  const supabase = createServiceRoleClient();
  const barberia = slug ? await getBarberiaBySlug(supabase, slug) : null;
  const nombre = String(user.user_metadata?.nombre ?? user.user_metadata?.given_name ?? "").trim();
  const destino = barberia ? `${getSiteUrl()}/${barberia.slug}` : `${getSiteUrl()}/cuenta`;

  const html = emailLayout(
    `Te damos la bienvenida a ${PLATAFORMA.nombre}`,
    `<p style="margin:0 0 16px">Hola${nombre ? ` ${escapeHtml(nombre)}` : ""}, tu cuenta ya está lista.</p>
     <p style="margin:0 0 16px">${barberia ? `Ya puedes reservar en <strong>${escapeHtml(barberia.nombre)}</strong> y ver tus citas desde tu cuenta.` : "Desde tu cuenta puedes ver tus reservas, tus barberías y registrar la tuya."}</p>
     <p style="margin:0">${emailButton(destino, barberia ? `Ir a ${barberia.nombre}` : "Ir a mi cuenta")}</p>`,
    PLATAFORMA.nombre,
  );

  const enviado = await sendEmail({ to: user.email, subject: `Bienvenido a ${PLATAFORMA.nombre}`, html, fromName: PLATAFORMA.nombre, replyTo: PLATAFORMA.emailContacto });
  if (!enviado) return;
  // Si falla el marcador el próximo ingreso reenvía: aceptable frente a perder el aviso.
  const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, bienvenida_enviada: true } });
  if (error) console.error("[notificaciones] No se pudo marcar la bienvenida:", error);
}

/** Recordatorio 24 h antes de la cita. Reclama cada reserva con un UPDATE condicional: un solo correo aunque corran dos jobs. */
export async function notificarRecordatorios(): Promise<number> {
  const supabase = createServiceRoleClient();
  const ahora = Date.now();
  const { data, error } = await supabase
    .from("reserva")
    .update({ recordatorio_enviado_at: new Date(ahora).toISOString() })
    .is("recordatorio_enviado_at", null)
    .in("estado", ["pendiente", "confirmada"])
    .gt("fecha_hora_inicio", new Date(ahora + 3600_000).toISOString()) // las reservadas con menos de 1 h no se recuerdan
    .lte("fecha_hora_inicio", new Date(ahora + 24 * 3600_000).toISOString())
    .select("id_reserva");
  if (error) {
    console.error("[notificaciones] Error reclamando recordatorios:", error);
    return 0;
  }
  let enviados = 0;
  for (const { id_reserva } of data ?? []) {
    if (await enviarRecordatorio(id_reserva)) enviados++;
    // Falló el envío: se libera la reserva para que el próximo job lo reintente
    else await supabase.from("reserva").update({ recordatorio_enviado_at: null }).eq("id_reserva", id_reserva);
  }
  return enviados;
}

async function enviarRecordatorio(idReserva: number): Promise<boolean> {
  const info = await cargarReserva(idReserva);
  if (!info?.contacto) return false;
  const { barberia } = info;
  const html = emailLayout(
    "Te esperamos pronto",
    `<p style="margin:0 0 16px">Hola ${escapeHtml(info.contacto.nombre)}, te recordamos tu cita:</p>
     ${emailDetalle([
       ["Servicio", info.servicio],
       ["Barbero", info.barbero],
       ["Fecha", formatFecha(info.fecha, "EEEE d 'de' MMMM")],
       ["Hora", info.hora],
       ...(info.sucursal ? [["Sucursal", `${info.sucursal.nombre} · ${info.sucursal.direccion}`] as [string, string]] : []),
     ])}
     <p style="margin:0">${emailButton(reprogramarUrl(barberia.slug, idReserva), "Cambiar la hora")}${emailButton(bookingActionUrl("cancel", idReserva), "Cancelar cita", "#dc2626")}</p>`,
    barberia.nombre,
  );
  return sendEmail({ to: info.contacto.correo, subject: `Recordatorio de tu cita en ${barberia.nombre}`, html, fromName: barberia.nombre, replyTo: barberia.email_contacto });
}

/** Correo de invitación al equipo de una barbería (link a /invitacion/<token>). Devuelve si se envió. */
export async function notificarInvitacion(idInvitacion: number): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: inv, error } = await supabase
    .from("invitacion")
    .select("id_barberia, correo, rol, token, estado, expira_at, invitado_por")
    .eq("id_invitacion", idInvitacion)
    .single();

  if (error || !inv || inv.estado !== "pendiente") {
    console.error(`[notificaciones] No se pudo cargar la invitación ${idInvitacion}:`, error);
    return false;
  }

  const [barberia, { data: quien }] = await Promise.all([
    getBarberiaById(supabase, inv.id_barberia),
    inv.invitado_por
      ? supabase.from("usuario").select("nombre, apellido").eq("id_usuario", inv.invitado_por).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!barberia) return false;

  const link = `${getSiteUrl()}/invitacion/${inv.token}`;
  const rol = inv.rol === "admin" ? "administrador" : "barbero";
  const invitador = quien ? [quien.nombre, quien.apellido].filter(Boolean).join(" ") : barberia.nombre;
  const vence = formatFecha(toZoned(inv.expira_at, DEFAULT_TZ).fecha, "d 'de' MMMM");

  const html = emailLayout(
    `Te invitan a ${barberia.nombre}`,
    `<p style="margin:0 0 16px">${escapeHtml(invitador)} te invita a unirte al equipo de
     <strong>${escapeHtml(barberia.nombre)}</strong> como ${rol}.</p>
     <p style="margin:0 0 16px">Si aún no tienes cuenta, podrás crearla gratis con este mismo correo.
     La invitación vence el ${escapeHtml(vence)}.</p>
     <p style="margin:0">${emailButton(link, "Ver invitación")}</p>`,
    barberia.nombre,
    `Recibes este correo porque ${barberia.nombre} te invitó a su equipo. Si no esperabas esta invitación, ignora este mensaje.`,
  );

  const enviado = await sendEmail({
    to: inv.correo,
    subject: `${barberia.nombre} te invita a su equipo`,
    html,
    fromName: barberia.nombre,
    replyTo: barberia.email_contacto,
  });
  if (!enviado) console.info(`[notificaciones] Link invitación ${idInvitacion} (${inv.correo}): ${link}`);
  return enviado;
}
