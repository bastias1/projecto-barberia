import { createClient } from "@/utils/supabase/server";
import { getBarberiaBySlug, getSucursales } from "@/lib/barberia";

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
        // No se crea el pedido (que reserva stock) si la barbería no puede cobrar
        const { data: aceptaPagos } = await supabase.rpc('barberia_acepta_pagos', { p_barberia: idBarberia });
        if (!aceptaPagos) {
            return Response.json({ error: 'Esta barbería aún no habilita pagos en línea.' }, { status: 409 });
        }
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

        // 3. Order lines: el trigger fija el precio vigente y valida el stock (se descuenta al pagar)
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

        // El trigger fijó el total con los precios vigentes: el checkout lo compara con el del carrito
        const { data: total } = await supabase
            .from('pedido')
            .select('monto_total')
            .eq('id_pedido', pedido.id_pedido)
            .single();

        // El pago se hace en /<slug>/checkout con Checkout API (/api/checkout/pagar)
        return Response.json({ pedido: pedido.id_pedido, monto: Number(total?.monto_total ?? 0) });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el pedido' }, { status: 500 });
    }
}
