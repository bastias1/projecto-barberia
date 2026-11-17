import { Invoice, Order, Payment, PreApproval, WebhookSignatureValidator } from 'mercadopago';
import { aplicarCobroSuscripcion, aplicarPreapproval, mercadoPagoClient } from "@/lib/suscripcion";
import { estadoPagoDesdePayment, registrarPagoOrder } from "@/lib/pago-pedido";

const client = mercadoPagoClient();

// Firma válida con el secreto de la app actual o, durante la transición, con el
// de la app anterior (sus preapprovals siguen notificando desde esa app)
function firmaValida(request: Request, dataId: string, secrets: string[]): boolean {
    return secrets.some((secret) => {
        try {
            WebhookSignatureValidator.validate({
                xSignature: request.headers.get("x-signature"),
                xRequestId: request.headers.get("x-request-id"),
                dataId,
                secret,
            });
            return true;
        } catch {
            return false;
        }
    });
}

export async function POST(request: Request) {
    console.log('🔔 Webhook endpoint called');
    try {
        const body = await request.json().catch(() => null);

        if (!body) {
            console.error('❌ No body in request');
            return new Response('No body', { status: 400 });
        }

        console.log('📦 Webhook body:', JSON.stringify(body, null, 2));

        // Verify Signature (REQUIRED for security)
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret) {
            console.error('MERCADOPAGO_WEBHOOK_SECRET is not configured');
            return new Response("Webhook secret not configured", { status: 500 });
        }

        // data.id viene en la query; si es alfanumérico (orders: ORD…) va en minúsculas en el manifest
        const dataId = (new URL(request.url).searchParams.get("data.id") ?? String(body.data?.id ?? '')).toLowerCase();
        const secrets = [secret, process.env.MERCADOPAGO_WEBHOOK_SECRET_ANTERIOR].filter((s): s is string => !!s);

        if (!firmaValida(request, dataId, secrets)) {
            console.error("Invalid signature - potential security threat");
            return new Response("Invalid signature", { status: 401 });
        }

        console.log("✅ Webhook signature verified successfully");

        const { type, data } = body;

        // Suscripción de la barbería: autorización del cobro mensual y cada cobro
        if (type === 'subscription_preapproval' || type === 'subscription_authorized_payment') {
            const { createServiceRoleClient } = await import("@/utils/supabase/service-role");
            const supabase = createServiceRoleClient();
            try {
                if (type === 'subscription_preapproval') {
                    const preapproval = await new PreApproval(client).get({ id: String(data.id) });
                    await aplicarPreapproval(supabase, preapproval);
                } else {
                    const cobro = await new Invoice(client).get({ id: String(data.id) });
                    await aplicarCobroSuscripcion(supabase, cobro);
                }
            } catch (error) {
                console.error(`Error processing ${type}:`, error);
                if ((error as { status?: number } | null)?.status === 404) {
                    return new Response(null, { status: 200 }); // notificación de prueba
                }
                throw error;
            }
            return new Response(null, { status: 200 });
        }

        // Pago de un pedido de la tienda (Checkout API / Orders API)
        if (type === 'order') {
            const { createServiceRoleClient } = await import("@/utils/supabase/service-role");
            try {
                const order = await new Order(client).get({ id: String(data.id) });
                await registrarPagoOrder(createServiceRoleClient(), order);
            } catch (error) {
                console.error('Error processing order:', error);
                if ((error as { status?: number } | null)?.status === 404) {
                    return new Response(null, { status: 200 }); // notificación de prueba
                }
                throw error;
            }
            return new Response(null, { status: 200 });
        }

        // Pedidos antiguos pagados con Checkout Pro (Payments API)
        if (type === 'payment') {
            try {
                const payment = new Payment(client);
                const paymentData = await payment.get({ id: data.id });

                console.log('Webhook received: payment');
                console.log('Payment ID:', data.id);
                console.log('Payment status:', paymentData.status);
                console.log('External reference:', paymentData.external_reference);

                if (paymentData.external_reference) {
                    const { createServiceRoleClient } = await import("@/utils/supabase/service-role");
                    const supabase = createServiceRoleClient();

                    const estado = estadoPagoDesdePayment(paymentData.status);

                    const { data: pedido } = await supabase
                        .from('pedido')
                        .select('id_pedido, id_barberia, monto_total')
                        .eq('id_pedido', paymentData.external_reference)
                        .maybeSingle();

                    if (!pedido) {
                        console.error(`Order ${paymentData.external_reference} not found`);
                        return new Response(null, { status: 200 });
                    }

                    // Un pago por transacción de Mercado Pago (pago_transaccion_unica). El
                    // trigger aplicar_pago_a_pedido actualiza estado_pago del pedido y lo
                    // pasa a 'confirmado' cuando se aprueba.
                    const { error } = await supabase
                        .from('pago')
                        .upsert({
                            id_barberia: pedido.id_barberia,
                            concepto: 'pedido',
                            id_pedido: pedido.id_pedido,
                            monto: paymentData.transaction_amount ?? pedido.monto_total,
                            proveedor: 'mercadopago',
                            id_transaccion_externa: String(data.id),
                            estado,
                            detalle: {
                                status: paymentData.status,
                                status_detail: paymentData.status_detail,
                                payment_method: paymentData.payment_method_id,
                                installments: paymentData.installments,
                            },
                        }, { onConflict: 'proveedor,id_transaccion_externa' });

                    if (error) {
                        console.error('Error recording payment:', error);
                    } else {
                        console.log(`Order ${pedido.id_pedido} payment recorded as ${estado}`);
                        if (estado === 'aprobado') {
                            const { notificarStockBajo } = await import("@/lib/notifications");
                            await notificarStockBajo(pedido.id_barberia).catch((e) => console.error('Error en alerta de stock:', e));
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching payment:', error);
                // Handle test payments or payment not found gracefully (SDK v3: MercadoPagoError.causes)
                const mpError = error as { status?: number; causes?: { code?: number }[] } | null;
                if (mpError?.status === 404 || mpError?.causes?.[0]?.code === 2000) {
                    console.log('Test webhook or payment not found - ignoring:', data.id);
                    return new Response(null, { status: 200 }); // Return 200 for test webhooks
                }
                throw error; // Re-throw other errors
            }
        }

        return new Response(null, { status: 200 });
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(null, { status: 500 });
    }
}
