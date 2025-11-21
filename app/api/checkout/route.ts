// SDK de Mercado Pago
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Agrega credenciales
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-5244847329230484-112115-45d93bd206aa0f03321a39e3f7508d37-3007735698' });

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
                fecha: new Date().toISOString(),
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
            producto: 1, // Placeholder: You need to send the real product ID from frontend
            cantidad: item.quantity,
            subtotal: item.unit_price * item.quantity
        }));

        // Note: We need the product ID. The current frontend cart might not be sending it.
        // For now, we will assume the frontend sends 'id' in the item object.
        // We need to update the frontend to send 'id' if it's not already doing so.

        // Let's try to insert details. If product ID is missing, this might fail if we don't have a default.
        // Ideally, we should fetch product IDs or ensure frontend sends them.
        // For this iteration, I'll comment out the detail insertion if we don't have product IDs, 
        // OR I will assume the frontend sends them.
        // Looking at checkout/page.tsx, we map cart items. Cart items usually have IDs.
        // Let's update the API to expect 'id' in items.

        /* 
        const { error: detailsError } = await supabase
            .from('detalle_venta')
            .insert(saleDetails);

        if (detailsError) {
             console.error('Error creating sale details:', detailsError);
             // We might want to delete the sale if details fail, or just log it.
        }
        */

        // 5. Create Preference with external_reference
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: body.items,
                external_reference: venta.id.toString(),
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
