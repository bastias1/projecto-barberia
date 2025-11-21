// SDK de Mercado Pago
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Agrega credenciales
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });

import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        // 1. Get User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Calculate Total
        const total = body.items.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);

        // 3. Create Sale in DB (Pending)
        const { data: venta, error: ventaError } = await supabase
            .from('venta')
            .insert({
                usuario: user.id,
                total: total,
                estado_pago: 'pending',
                estado: 'pending',
                tipo_entrega: body.delivery_method,
                direccion_envio: body.shipping_address ? JSON.stringify(body.shipping_address) : null
            })
            .select()
            .single();

        if (ventaError) {
            console.error('Error creating sale:', ventaError);
            return Response.json({ error: 'Error creating sale record' }, { status: 500 });
        }

        // 4. Create Sale Details
        const saleDetails = body.items.map((item: any) => ({
            venta_id: venta.id,
            producto: item.id,
            cantidad: item.quantity,
            subtotal: item.unit_price * item.quantity
        }));

        const { error: detailsError } = await supabase
            .from('detalle_venta')
            .insert(saleDetails);

        if (detailsError) {
            console.error('Error creating sale details:', detailsError);
            // Continue anyway - we have the venta record
        }

        // 5. Create Preference with external_reference and proper item formatting
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: body.items.map((item: any) => ({
                    title: item.title,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    currency_id: 'CLP'
                })),
                external_reference: venta.id.toString(),
                notification_url: "https://bastias.dev/api/webhooks/mercadopago",
                back_urls: {
                    success: "https://bastias.dev/checkout/success",
                    failure: "https://bastias.dev/checkout/failure",
                    pending: "https://bastias.dev/checkout/pending",
                },
                auto_return: "approved",
            }
        });

        return Response.json({ url: result.init_point, id: result.id });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error creating preference' }, { status: 500 });
    }
}
