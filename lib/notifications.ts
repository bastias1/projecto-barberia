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

  const [barberia, { data: admins }] = await Promise.all([
    getBarberiaById(supabase, idBarberia),
    supabase.from("usuario_barberia").select("id_usuario").eq("id_barberia", idBarberia).eq("rol", "admin").eq("activo", true),
  ]);
  if (!barberia) return;
  const { data: usuarios } = await supabase
    .from("usuario")
    .select("email")
    .in("id_usuario", (admins ?? []).map((a) => a.id_usuario))
    .is("deleted_at", null);

  const html = emailLayout(
    "Productos con stock bajo",
    `<p style="margin:0 0 16px">Estos productos llegaron a su stock mínimo:</p>
     ${emailDetalle(bajos.map((p) => [p.nombre, `quedan ${p.stock} (mínimo ${p.stock_minimo})`]))}
     <p style="margin:0">${emailButton(`${getSiteUrl()}/${barberia.slug}/dashboard/productos`, "Ver productos")}</p>`,
    barberia.nombre,
  );
  for (const u of usuarios ?? []) {
    await sendEmail({ to: u.email, subject: `Stock bajo en ${barberia.nombre}`, html, fromName: barberia.nombre });
  }
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
