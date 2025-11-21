import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { createClient } from "@/utils/supabase/server";

const client = new MercadoPagoConfig({ accessToken: 'APP_USR-5244847329230484-112115-45d93bd206aa0f03321a39e3f7508d37-3007735698' });

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);

        if (!body) {
            return new Response('No body', { status: 400 });
        }

        // Verify Signature
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (secret) {
            const xSignature = request.headers.get("x-signature");
            const xRequestId = request.headers.get("x-request-id");

            if (!xSignature || !xRequestId) {
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
                return new Response("Invalid signature", { status: 401 });
            }
        }

        const { type, data } = body;

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

                    // Map Mercado Pago status to your database status
                    let estado_pago = 'pending';
                    if (paymentData.status === 'approved') {
                        estado_pago = 'approved';
                    } else if (paymentData.status === 'rejected') {
                        estado_pago = 'rejected';
                    } else if (paymentData.status === 'cancelled') {
                        estado_pago = 'cancelled';
                    }

                    console.log(`Attempting to update sale ${paymentData.external_reference} to ${estado_pago}`);

                    const { error } = await supabase
                        .from('venta')
                        .update({
                            estado_pago: estado_pago,
                            estado: paymentData.status === 'approved' ? 'completed' : 'pending'
                        })
                        .eq('id', paymentData.external_reference);

                    if (error) {
                        console.error('Error updating sale status:', error);
                    } else {
                        console.log(`Sale ${paymentData.external_reference} updated to ${estado_pago}`);
                    }
                }
            } catch (error: any) {
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
