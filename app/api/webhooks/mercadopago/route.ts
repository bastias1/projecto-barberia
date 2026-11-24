import { Invoice, Order, Payment, PreApproval, WebhookSignatureValidator } from 'mercadopago';
import { aplicarCobroSuscripcion, aplicarPreapproval } from "@/lib/suscripcion";
import { mercadoPagoClient, registrarPagoOrder, registrarPagoPayment } from "@/lib/pagos";
import { SinMercadoPago, tokenDeVendedor } from "@/lib/mercadopago-barberia";
import { createServiceRoleClient } from "@/utils/supabase/service-role";

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

type Admin = ReturnType<typeof createServiceRoleClient>;
type Notificacion = { id: string; userId: number; action?: string };

/** Un manejador por tópico. Los que no están aquí se ignoran (200). */
const MANEJADORES: Record<string, (admin: Admin, n: Notificacion) => Promise<unknown>> = {
    // Suscripción de la barbería: autorización del cobro mensual y cada cobro (cuenta de Sunwalk)
    subscription_preapproval: async (admin, n) => aplicarPreapproval(admin, await new PreApproval(client).get({ id: n.id })),
    subscription_authorized_payment: async (admin, n) => aplicarCobroSuscripcion(admin, await new Invoice(client).get({ id: n.id })),
    // Pedido de la tienda: la order vive en la cuenta del vendedor de la notificación y se lee con su token
    order: async (admin, n) => {
        const vendedor = await tokenDeVendedor(admin, n.userId);
        const order = await new Order(vendedor ? mercadoPagoClient(vendedor.accessToken) : client).get({ id: n.id });
        return registrarPagoOrder(admin, order, vendedor?.idBarberia ?? null);
    },
    // Pedidos antiguos pagados con Checkout Pro (Payments API)
    payment: async (admin, n) => registrarPagoPayment(admin, await new Payment(client).get({ id: n.id })),
    // Vinculaciones OAuth (mp-connect): su formato no está documentado; solo se registra para verlo.
    // Desconectar a una barbería por una suposición sería peor que no hacerlo.
    'mp-connect': async (_admin, n) => console.log('Webhook mp-connect:', JSON.stringify(n)),
};

/** Notificación de prueba o recurso inexistente (SDK v3: status 404 o causes[0].code 2000). */
function noEncontrado(error: unknown): boolean {
    const e = error as { status?: number; causes?: { code?: number }[] } | null;
    return e?.status === 404 || e?.causes?.[0]?.code === 2000;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    if (!body) return new Response('No body', { status: 400 });

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

    const manejar = MANEJADORES[body.type];
    if (!manejar) return new Response(null, { status: 200 });

    try {
        await manejar(createServiceRoleClient(), { id: String(body.data?.id), userId: Number(body.user_id), action: body.action });
    } catch (error) {
        if (error instanceof SinMercadoPago || noEncontrado(error)) {
            console.error(`Webhook ${body.type} ${body.data?.id} ignorado:`, error);
            return new Response(null, { status: 200 });
        }
        console.error(`Webhook ${body.type} error:`, error);
        return new Response(null, { status: 500 });
    }
    return new Response(null, { status: 200 });
}
