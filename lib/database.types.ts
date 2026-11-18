// Tipos del esquema `public` (multi-barbería). Se mantienen a mano:
// actualizar cuando cambie el esquema en Supabase.

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
};

export type EstadoReserva = "pendiente" | "confirmada" | "completada" | "cancelada" | "no_asistio";
export type EstadoPedido = "pendiente" | "confirmado" | "preparando" | "listo_retiro" | "enviado" | "entregado" | "cancelado";
export type EstadoPagoPedido = "pendiente" | "pagado" | "rechazado" | "reembolsado";
export type RolBarberia = "admin" | "profesional" | "cliente";

export interface Database {
  public: {
    Tables: {
      barberia: Table<{
        id_barberia: string;
        nombre: string;
        slug: string;
        telefono: string | null;
        email_contacto: string | null;
        // Contenido público de /<slug>
        logo_url: string | null;
        logo_oscuro_url: string | null;
        eslogan: string | null;
        descripcion: string | null;
        instagram: string | null;
        galeria: string[];
        plazo_cancelacion_min: number; // HU-22
        activa: boolean;
        created_at: string;
        updated_at: string;
      }, "nombre" | "slug">;
      sucursal: Table<{
        id_sucursal: number;
        id_barberia: string;
        slug: string; // generado desde el nombre si no se indica; página /<barberia>/<slug>
        nombre: string;
        direccion: string;
        comuna: string;
        region: string | null;
        telefono: string | null;
        zona_horaria: string;
        activa: boolean;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "nombre" | "direccion" | "comuna">;
      usuario: Table<{
        id_usuario: string; // = auth.users.id
        nombre: string;
        apellido: string | null;
        email: string;
        telefono: string | null;
        rol: "superadmin" | "usuario";
        profile_image: string | null;
        rut: string | null; // sin uso: el campo se quitó de la app
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }, "id_usuario" | "nombre" | "email">;
      usuario_barberia: Table<{
        id_usuario: string;
        id_barberia: string;
        rol: RolBarberia;
        activo: boolean;
        created_at: string;
        updated_at: string;
      }, "id_usuario" | "id_barberia" | "rol">;
      direccion_usuario: Table<{
        id_direccion: string;
        id_usuario: string;
        nombre_etiqueta: string | null;
        calle: string;
        depto: string | null;
        comuna: string;
        ciudad: string;
        region: string | null;
        telefono: string | null;
        created_at: string;
        updated_at: string;
      }, "id_usuario" | "calle" | "comuna" | "ciudad">;
      guest_usuario: Table<{
        id_guest: string;
        id_barberia: string;
        nombre: string;
        apellido: string;
        correo: string;
        telefono: string | null;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "nombre" | "apellido" | "correo">;
      profesional: Table<{
        id_barberia: string;
        id_profesional: string; // = usuario.id_usuario
        alias: string | null;
        especialidad: string | null;
        activo: boolean;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "id_profesional">;
      servicio: Table<{
        id_servicio: number;
        id_barberia: string;
        nombre: string;
        descripcion: string | null;
        duracion_min: number;
        precio: number;
        activo: boolean;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "nombre" | "precio">;
      profesional_servicio: Table<{
        id_barberia: string;
        id_profesional: string;
        id_servicio: number;
        created_at: string;
      }, "id_barberia" | "id_profesional" | "id_servicio">;
      // Invitaciones al equipo (se aceptan con la RPC responder_invitacion)
      invitacion: Table<{
        id_invitacion: number;
        id_barberia: string;
        correo: string; // minúsculas
        rol: "profesional" | "admin";
        token: string;
        estado: "pendiente" | "aceptada" | "rechazada" | "cancelada";
        invitado_por: string | null;
        expira_at: string;
        respondida_at: string | null;
        created_at: string;
      }, "id_barberia" | "correo">;
      // Sucursales donde atiende cada barbero (sus horarios solo pueden estar en ellas)
      profesional_sucursal: Table<{
        id_barberia: string;
        id_profesional: string;
        id_sucursal: number;
        created_at: string;
      }, "id_barberia" | "id_profesional" | "id_sucursal">;
      horario_atencion: Table<{
        id_horario: number;
        id_barberia: string;
        id_profesional: string;
        id_sucursal: number;
        dia_semana: number; // 0 = domingo
        hora_inicio: string;
        hora_fin: string;
        activo: boolean;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "id_profesional" | "id_sucursal" | "dia_semana" | "hora_inicio" | "hora_fin">;
      dia_bloqueado: Table<{
        id_dia_bloqueado: number;
        id_barberia: string;
        id_profesional: string;
        fecha: string;
        motivo: string | null;
        created_at: string;
      }, "id_barberia" | "id_profesional" | "fecha">;
      reserva: Table<{
        id_reserva: number;
        id_barberia: string;
        id_sucursal: number;
        id_cliente: string | null; // cliente registrado, o
        id_guest: string | null;   // invitado (exactamente uno de los dos)
        id_profesional: string;
        id_servicio: number;
        fecha_hora_inicio: string;
        fecha_hora_fin: string; // lo calcula el trigger según la duración
        estado: EstadoReserva;
        monto: number; // lo fija el trigger con el precio vigente
        notas: string | null;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "id_sucursal" | "id_profesional" | "id_servicio" | "fecha_hora_inicio">;
      producto: Table<{
        id_producto: number;
        id_barberia: string;
        nombre: string;
        descripcion: string | null;
        categoria: string;
        precio: number;
        stock: number;
        stock_minimo: number;
        imagen_url: string | null;
        tag: string | null;
        activo: boolean;
        alerta_stock_at: string | null; // correo de stock bajo ya enviado
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "nombre" | "categoria" | "precio">;
      movimiento_stock: Table<{
        id_movimiento: number;
        id_barberia: string;
        id_producto: number;
        tipo: "ingreso" | "ajuste" | "venta" | "devolucion";
        cantidad: number; // con signo
        stock_resultante: number;
        id_usuario: string | null;
        created_at: string;
      }, never>; // solo lo escribe el trigger de producto
      pedido: Table<{
        id_pedido: number;
        id_barberia: string;
        id_sucursal: number | null;
        id_cliente: string | null;
        estado: EstadoPedido;
        estado_pago: EstadoPagoPedido; // lo actualiza el trigger de pago
        monto_total: number; // suma de detalle_pedido (trigger)
        tipo_entrega: "retiro" | "despacho";
        direccion_envio: string | null; // JSON de la dirección
        stock_descontado: boolean; // lo maneja el trigger (se descuenta al pagar)
        created_at: string;
        updated_at: string;
      }, "id_barberia">;
      detalle_pedido: Table<{
        id_detalle: number;
        id_barberia: string;
        id_pedido: number;
        id_producto: number;
        cantidad: number;
        precio_unitario: number; // lo fija el trigger; también valida stock
        subtotal: number; // columna generada
      }, "id_barberia" | "id_pedido" | "id_producto" | "cantidad">;
      pago: Table<{
        id_pago: number;
        id_barberia: string;
        concepto: "pedido" | "reserva" | "suscripcion" | "modulo";
        id_pedido: number | null;
        id_reserva: number | null;
        id_suscripcion: number | null;
        id_suscripcion_modulo: number | null;
        monto: number;
        proveedor: "webpay" | "mercadopago" | "flow" | "efectivo" | "transferencia";
        id_transaccion_externa: string | null;
        estado: "pendiente" | "aprobado" | "rechazado" | "anulado" | "reembolsado";
        detalle: Record<string, unknown> | null;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "concepto" | "monto" | "proveedor">;
      resena: Table<{
        id_resena: number;
        id_barberia: string;
        id_cliente: string | null;
        id_guest: string | null;
        id_reserva: number | null;
        id_profesional: string | null;
        id_servicio: number | null;
        id_producto: number | null;
        calificacion: number; // 1-5
        comentario: string | null;
        created_at: string;
        updated_at: string;
      }, "id_barberia" | "calificacion">;
      cliente_bloqueado: Table<{
        id_bloqueo: number;
        id_barberia: string;
        correo: string; // siempre en minúsculas
        telefono: string | null;
        razon: string | null;
        bloqueado_por: string | null;
        created_at: string;
      }, "id_barberia" | "correo">;
      auditoria_admin: Table<{
        id: number;
        id_usuario: string | null; // superadmin que actuó
        accion: string;
        entidad: "barberia" | "plan" | "usuario";
        id_entidad: string;
        detalle: Record<string, unknown>; // valores antes/después
        created_at: string;
      }, "id_usuario" | "accion" | "entidad" | "id_entidad">;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
