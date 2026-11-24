import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaBySlug } from "@/lib/barberia";
import { Order } from "mercadopago";
import { crearOrder, estadoPagoDesdeOrder, mensajeRechazo, mercadoPagoClient, registrarPagoOrder } from "@/lib/pagos";
import { SinMercadoPago, tokenBarberia } from "@/lib/mercadopago-barberia";
import { armarOrden } from "@/lib/orden-mp";
import { one } from "@/lib/utils";

const TIPOS_TARJETA = ["credit_card", "debit_card", "prepaid_card"];

// Paga un pedido pendiente con Checkout API (Orders API). El monto sale del
// pedido en la base; del navegador solo llegan el token de la tarjeta y su medio de pago.
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = typeof body.token === 'string' ? body.token : '';
        const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId : '';
        const idPedido = Number(body.pedido);
        if (!token || !paymentMethodId || !Number.isInteger(idPedido)) {
            return Response.json({ error: 'Faltan los datos de la tarjeta' }, { status: 400 });
        }
        const tipo = TIPOS_TARJETA.includes(body.paymentMethodType) ? body.paymentMethodType : 'credit_card';

        const barberia = await getBarberiaBySlug(supabase, String(body.barberia ?? ''));
        if (!barberia) {
            return Response.json({ error: 'Barbería no encontrada' }, { status: 404 });
        }

        // El staff también puede leer pedidos ajenos: se exige que sea del comprador
        const { data: pedido } = await supabase
            .from('pedido')
            .select('id_pedido, monto_total, estado, estado_pago')
            .eq('id_barberia', barberia.id_barberia)
            .eq('id_pedido', idPedido)
            .eq('id_cliente', user.id)
            .maybeSingle();

        if (!pedido) {
            return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
        }
        if (pedido.estado_pago === 'pagado') {
            return Response.json({ estado: 'aprobado' });
        }
        if (pedido.estado !== 'pendiente' || !(Number(pedido.monto_total) > 0)) {
            return Response.json({ error: 'Este pedido ya no se puede pagar' }, { status: 409 });
        }

        // El dinero va a la cuenta de Mercado Pago de la barbería: sin ella no se cobra (jamás con la de Sunwalk)
        let accessToken: string;
        try {
            accessToken = await tokenBarberia(createServiceRoleClient(), barberia.id_barberia);
        } catch (error) {
            if (error instanceof SinMercadoPago) {
                return Response.json({ error: 'Esta barbería aún no habilita pagos en línea.' }, { status: 409 });
            }
            throw error;
        }

        // Un intento anterior aún en proceso podría aprobarse después: se consulta a
        // Mercado Pago antes de cobrar de nuevo, para no cobrar dos veces el mismo pedido
        const { data: enCurso } = await supabase
            .from('pago')
            .select('id_transaccion_externa')
            .eq('id_barberia', barberia.id_barberia)
            .eq('id_pedido', pedido.id_pedido)
            .eq('estado', 'pendiente')
            .like('id_transaccion_externa', 'ORD%') // los pagos antiguos de Checkout Pro no son orders
            .limit(1)
            .maybeSingle();
        if (enCurso) {
            const anterior = await new Order(mercadoPagoClient(accessToken)).get({ id: enCurso.id_transaccion_externa });
            await registrarPagoOrder(createServiceRoleClient(), anterior, barberia.id_barberia);
            const estadoAnterior = estadoPagoDesdeOrder(anterior.status);
            if (estadoAnterior === 'pendiente' || estadoAnterior === 'aprobado') {
                return Response.json({ estado: estadoAnterior, orderId: anterior.id });
            }
        }

        // CLP no tiene decimales: Orders API rechaza "15990.00" (does not match pattern)
        const monto = String(Math.round(Number(pedido.monto_total)));
        // En pruebas Orders API exige que el pagador sea un usuario de prueba comprador
        const email = process.env.MERCADOPAGO_TEST_PAYER_EMAIL || user.email;

        // La clave liga el intento al pedido y al token: dos solicitudes simultáneas con el mismo token no crean dos orders
        // Más datos del comprador y de la compra mejoran la aprobación (y la calidad de la integración)
        const [{ data: lineas }, { data: comprador }] = await Promise.all([
            supabase.from('detalle_pedido')
                .select('id_producto, cantidad, precio_unitario, producto:producto!detalle_pedido_producto_fkey (nombre)')
                .eq('id_barberia', barberia.id_barberia).eq('id_pedido', pedido.id_pedido),
            supabase.from('usuario').select('nombre, apellido, created_at').eq('id_usuario', user.id).maybeSingle(),
        ]);
        const deviceId = typeof body.deviceId === 'string' && body.deviceId.length <= 200 ? body.deviceId : undefined;

        const resultado = await crearOrder(accessToken, armarOrden({
            idPedido: pedido.id_pedido,
            monto,
            barberia: barberia.nombre,
            email,
            comprador: {
                nombre: comprador?.nombre || user.email?.split('@')[0] || 'Cliente',
                apellido: comprador?.apellido ?? null,
                registradoEn: comprador?.created_at ?? null,
            },
            items: (lineas ?? []).map((l) => ({
                idProducto: l.id_producto,
                nombre: one<{ nombre: string }>(l.producto)?.nombre ?? `Producto ${l.id_producto}`,
                cantidad: l.cantidad,
                precioUnitario: Number(l.precio_unitario),
            })),
            pago: { metodoId: paymentMethodId, tipo, token },
        }), `pedido-${pedido.id_pedido}-${token}`, deviceId);

        // 402: la order se creó pero el pago falló; viene en `data` y se registra igual
        const order = resultado.order;
        if (!order) {
            const r = resultado as { status: number; errores: unknown };
            console.error('Checkout API - Mercado Pago order error:', r.status, JSON.stringify(r.errores),
                { paymentMethodId, tipo, tokenLength: token.length });
            return Response.json({ error: 'No se pudo procesar el pago. Revisa los datos de la tarjeta e intenta nuevamente.' }, { status: 502 });
        }

        await registrarPagoOrder(createServiceRoleClient(), order, barberia.id_barberia);

        const estado = estadoPagoDesdeOrder(order.status);
        const detalle = order.transactions?.payments?.[0]?.status_detail ?? order.status_detail;
        return Response.json({
            estado,
            orderId: order.id,
            ...(estado === 'rechazado' ? { error: mensajeRechazo(detalle) } : {}),
        });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al procesar el pago' }, { status: 500 });
    }
}
