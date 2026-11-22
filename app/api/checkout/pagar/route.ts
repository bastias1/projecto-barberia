import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaBySlug } from "@/lib/barberia";
import { Order } from "mercadopago";
import { crearOrder, estadoPagoDesdeOrder, mensajeRechazo, mercadoPagoClient, registrarPagoOrder } from "@/lib/pagos";

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
            const anterior = await new Order(mercadoPagoClient()).get({ id: enCurso.id_transaccion_externa });
            await registrarPagoOrder(createServiceRoleClient(), anterior);
            const estadoAnterior = estadoPagoDesdeOrder(anterior.status);
            if (estadoAnterior === 'pendiente' || estadoAnterior === 'aprobado') {
                return Response.json({ estado: estadoAnterior, orderId: anterior.id });
            }
        }

        // CLP no tiene decimales: Orders API rechaza "15990.00" (does not match pattern)
        const monto = String(Math.round(Number(pedido.monto_total)));
        // En pruebas Orders API exige que el pagador sea un usuario de prueba comprador
        const email = process.env.MERCADOPAGO_TEST_PAYER_EMAIL || user.email;

        const resultado = await crearOrder({
            type: 'online',
            processing_mode: 'automatic',
            external_reference: String(pedido.id_pedido),
            description: `Pedido #${pedido.id_pedido} - ${barberia.nombre}`,
            total_amount: monto,
            payer: { email },
            transactions: {
                payments: [{
                    amount: monto,
                    payment_method: { id: paymentMethodId, type: tipo, token, installments: 1 },
                }],
            },
        });

        // 402: la order se creó pero el pago falló; viene en `data` y se registra igual
        const order = resultado.order;
        if (!order) {
            const r = resultado as { status: number; errores: unknown };
            console.error('Checkout API - Mercado Pago order error:', r.status, JSON.stringify(r.errores),
                { paymentMethodId, tipo, tokenLength: token.length });
            return Response.json({ error: 'No se pudo procesar el pago. Revisa los datos de la tarjeta e intenta nuevamente.' }, { status: 502 });
        }

        await registrarPagoOrder(createServiceRoleClient(), order);

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
