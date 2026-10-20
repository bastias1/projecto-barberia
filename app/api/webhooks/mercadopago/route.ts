import { Invoice, MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import crypto from 'crypto';
import { aplicarCobroSuscripcion, aplicarPreapproval } from "@/lib/suscripcion";

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '' });

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

        const xSignature = request.headers.get("x-signature");
        const xRequestId = request.headers.get("x-request-id");

        if (!xSignature || !xRequestId) {
            console.error("Missing signature headers");
            return new Response("Missing signature headers", { status: 401 });
        }

        const parts = xSignature.split(",");
        let ts;
        let hash;

        parts.forEach((part) => {
            const [key, value] = part.split("=");
            if (key && value) {
                const trimmedKey = key.trim();
                const trimmedValue = value.trim();
                if (trimmedKey === "ts") {
                    ts = trimmedValue;
                } else if (trimmedKey === "v1") {
                    hash = trimmedValue;
                }
            }
        });

        const manifest = `id:${body.data?.id};request-id:${xRequestId};ts:${ts};`;
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(manifest);
        const sha = hmac.digest("hex");

        if (sha !== hash) {
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

                    // Map Mercado Pago status to the pago.estado values
                    let estado = 'pendiente';
                    if (paymentData.status === 'approved') {
                        estado = 'aprobado';
                    } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
                        estado = 'rechazado';
                    } else if (paymentData.status === 'refunded' || paymentData.status === 'charged_back') {
                        estado = 'reembolsado';
                    }

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
                    }
                }
            } catch (error: any) {
                console.error('Error fetching payment:', error);
                // Handle test payments or payment not found gracefully
                if (error?.status === 404 || error?.cause?.[0]?.code === 2000) {
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
