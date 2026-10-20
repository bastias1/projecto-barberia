// SDK de Mercado Pago
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from "@/utils/supabase/server";
import { getBarberiaBySlug, getSucursales } from "@/lib/barberia";
import { getSiteUrl } from "@/lib/signed-links";
import { one } from "@/lib/utils";

// Agrega credenciales
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '' });

interface CheckoutItem {
    id: number;
    title: string;
    quantity: number;
    unit_price: number;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        // 1. Get User
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const items: CheckoutItem[] = body.items ?? [];
        if (items.length === 0) {
            return Response.json({ error: 'El carrito está vacío' }, { status: 400 });
        }

        const barberia = await getBarberiaBySlug(supabase, String(body.barberia ?? ''));
        if (!barberia) {
            return Response.json({ error: 'Barbería no encontrada' }, { status: 404 });
        }
        const idBarberia = barberia.id_barberia;
        const despacho = body.delivery_method === 'despacho';
        if (despacho && !body.shipping_address) {
            return Response.json({ error: 'Falta la dirección de despacho' }, { status: 400 });
        }

        // Quien compra queda como cliente de la barbería (no toca membresías existentes)
        await supabase
            .from('usuario_barberia')
            .upsert({ id_usuario: user.id, id_barberia: idBarberia, rol: 'cliente' }, { onConflict: 'id_usuario,id_barberia', ignoreDuplicates: true });

        // Los retiros se hacen en la sucursal principal
        const sucursal = despacho ? null : (await getSucursales(supabase, idBarberia))[0];

        // 2. Create order (monto_total y estado_pago los manejan los triggers)
        const { data: pedido, error: pedidoError } = await supabase
            .from('pedido')
            .insert({
                id_barberia: idBarberia,
                id_cliente: user.id,
                id_sucursal: sucursal?.id_sucursal ?? null,
                tipo_entrega: despacho ? 'despacho' : 'retiro',
                direccion_envio: despacho ? JSON.stringify(body.shipping_address) : null,
            })
            .select('id_pedido')
            .single();

        if (pedidoError || !pedido) {
            console.error('Checkout API - Error creating order:', JSON.stringify(pedidoError, null, 2));
            return Response.json({ error: 'Error al crear el pedido' }, { status: 500 });
        }

        // 3. Order lines: el trigger fija el precio vigente y descuenta stock
        const { error: detailsError } = await supabase
            .from('detalle_pedido')
            .insert(items.map((item) => ({
                id_barberia: idBarberia,
                id_pedido: pedido.id_pedido,
                id_producto: item.id,
                cantidad: item.quantity,
                precio_unitario: item.unit_price,
            })));

        if (detailsError) {
            console.error('Checkout API - Error creating order lines:', detailsError);
            // Un pedido pendiente sin detalle no sirve: el cliente puede cancelarlo
            await supabase.from('pedido').update({ estado: 'cancelado' }).eq('id_pedido', pedido.id_pedido);
            const stockMsg = detailsError.message?.includes('Stock insuficiente') || detailsError.message?.includes('no está disponible');
            return Response.json(
                { error: stockMsg ? 'Uno de los productos ya no tiene stock suficiente. Revisa tu carrito.' : 'Error al crear el pedido' },
                { status: stockMsg ? 409 : 500 }
            );
        }

        // 4. Items for Mercado Pago from the stored (server-side) prices
        const { data: detalles } = await supabase
            .from('detalle_pedido')
            .select('cantidad, precio_unitario, producto:producto!detalle_pedido_producto_fkey (nombre)')
            .eq('id_pedido', pedido.id_pedido);

        // Mercado Pago rechaza URLs de retorno en localhost: en desarrollo se usa el dominio público
        const siteUrl = getSiteUrl().startsWith("http://localhost") ? "https://sunwalk.app" : getSiteUrl();
        try {
            const preference = new Preference(client);
            const result = await preference.create({
                body: {
                    items: (detalles ?? []).map((d) => ({
                        id: String(pedido.id_pedido),
                        title: one<{ nombre: string }>(d.producto)?.nombre ?? 'Producto',
                        quantity: d.cantidad,
                        unit_price: Number(d.precio_unitario),
                        currency_id: 'CLP'
                    })),
                    external_reference: pedido.id_pedido.toString(),
                    notification_url: `${siteUrl}/api/webhooks/mercadopago`,
                    back_urls: {
                        success: `${siteUrl}/${barberia.slug}/checkout/success`,
                        failure: `${siteUrl}/${barberia.slug}/checkout/failure`,
                        pending: `${siteUrl}/${barberia.slug}/checkout/pending`,
                    },
                    auto_return: "approved",
                }
            });

            return Response.json({ url: result.init_point, id: result.id });
        } catch (mpError) {
            console.error('Checkout API - Mercado Pago preference error:', mpError);
            // Sin preferencia no hay forma de pagar: se cancela para liberar el stock
            await supabase.from('pedido').update({ estado: 'cancelado' }).eq('id_pedido', pedido.id_pedido);
            return Response.json({ error: 'No se pudo iniciar el pago. Intenta nuevamente.' }, { status: 502 });
        }
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error creating preference' }, { status: 500 });
    }
}
