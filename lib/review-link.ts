import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { DEFAULT_TZ, getBarberiaById } from "./barberia";
import { toZoned } from "./datetime";
import { one } from "./utils";

/*
 * Datos para reseñar desde el link firmado del correo. Se leen con service
 * role: quien abre el link no tiene sesión, y el token ya fue verificado.
 */

export type TipoResena = "reserva" | "pedido";

export interface ResenaReserva {
  tipo: "reserva";
  id: number;
  idBarberia: string;
  slugBarberia: string | null;
  completada: boolean;
  yaResenada: boolean;
  idCliente: string | null;
  idGuest: string | null;
  nombreCliente: string;
  servicio: string;
  barbero: string;
  fecha: string;
}

export interface ProductoResenable {
  id_producto: number;
  nombre: string;
  imagen_url: string | null;
  yaResenado: boolean;
}

export interface ResenaPedido {
  tipo: "pedido";
  id: number;
  idBarberia: string;
  slugBarberia: string | null;
  entregado: boolean;
  idCliente: string | null;
  nombreCliente: string;
  productos: ProductoResenable[];
}

export async function cargarResenaReserva(id: number): Promise<ResenaReserva | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("reserva")
    .select(`
      id_reserva, id_barberia, estado, fecha_hora_inicio, id_cliente, id_guest,
      servicio:servicio!reserva_servicio_fkey (nombre),
      profesional:profesional!reserva_profesional_fkey (alias, usuario:usuario!profesional_usuario_fkey (nombre)),
      guest:guest_usuario!reserva_guest_fkey (nombre),
      cliente:usuario!reserva_cliente_fkey (nombre)
    `)
    .eq("id_reserva", id)
    .maybeSingle();

  if (!data) return null;

  const { count } = await supabase
    .from("resena")
    .select("id_resena", { count: "exact", head: true })
    .eq("id_reserva", id);

  const profesional = one<{ alias: string | null; usuario: unknown }>(data.profesional);
  const barberia = await getBarberiaById(supabase, data.id_barberia);
  return {
    tipo: "reserva",
    id: data.id_reserva,
    idBarberia: data.id_barberia,
    slugBarberia: barberia?.slug ?? null,
    completada: data.estado === "completada",
    yaResenada: (count ?? 0) > 0,
    idCliente: data.id_cliente,
    idGuest: data.id_guest,
    nombreCliente: one<{ nombre: string }>(data.guest)?.nombre ?? one<{ nombre: string }>(data.cliente)?.nombre ?? "",
    servicio: one<{ nombre: string }>(data.servicio)?.nombre ?? "Servicio",
    barbero: profesional?.alias || one<{ nombre: string }>(profesional?.usuario)?.nombre || "tu barbero",
    fecha: toZoned(data.fecha_hora_inicio, DEFAULT_TZ).fecha,
  };
}

export async function cargarResenaPedido(id: number): Promise<ResenaPedido | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("pedido")
    .select(`
      id_pedido, id_barberia, estado, id_cliente,
      cliente:usuario!pedido_cliente_fkey (nombre),
      detalle_pedido!detalle_pedido_pedido_fkey (id_producto, producto:producto!detalle_pedido_producto_fkey (nombre, imagen_url))
    `)
    .eq("id_pedido", id)
    .maybeSingle();

  if (!data) return null;

  const detalles = (data.detalle_pedido ?? []) as Array<{ id_producto: number; producto: unknown }>;
  const { data: resenas } = data.id_cliente
    ? await supabase
        .from("resena")
        .select("id_producto")
        .eq("id_cliente", data.id_cliente)
        .in("id_producto", detalles.map((d) => d.id_producto))
    : { data: [] };
  const resenados = new Set((resenas ?? []).map((r) => r.id_producto));

  const barberia = await getBarberiaById(supabase, data.id_barberia);
  return {
    tipo: "pedido",
    id: data.id_pedido,
    idBarberia: data.id_barberia,
    slugBarberia: barberia?.slug ?? null,
    entregado: data.estado === "entregado",
    idCliente: data.id_cliente,
    nombreCliente: one<{ nombre: string }>(data.cliente)?.nombre ?? "",
    productos: detalles.map((d) => {
      const producto = one<{ nombre: string; imagen_url: string | null }>(d.producto);
      return {
        id_producto: d.id_producto,
        nombre: producto?.nombre ?? "Producto",
        imagen_url: producto?.imagen_url ?? null,
        yaResenado: resenados.has(d.id_producto),
      };
    }),
  };
}
