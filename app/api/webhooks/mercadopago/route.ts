import { Invoice, Order, Payment, PreApproval, WebhookSignatureValidator } from 'mercadopago';
import { aplicarCobroSuscripcion, aplicarPreapproval } from "@/lib/suscripcion";
import { mercadoPagoClient, registrarPagoOrder, registrarPagoPayment } from "@/lib/pagos";

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
                const payment = await new Payment(client).get({ id: data.id });
                console.log(`Webhook received: payment ${data.id} (${payment.status}), external reference ${payment.external_reference}`);

                const { createServiceRoleClient } = await import("@/utils/supabase/service-role");
                await registrarPagoPayment(createServiceRoleClient(), payment);
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
