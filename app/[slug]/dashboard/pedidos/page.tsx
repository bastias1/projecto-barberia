import { createClient } from "@/utils/supabase/server";
import { PedidosClient } from "@/components/dashboard/pedidos/pedidos-client";
import { requireStaff } from "@/lib/staff-context";
import { getModulosCached } from "@/lib/barberia-server";
import { ModuloNoDisponible } from "@/components/modulo-no-disponible";

export default async function PedidosPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const ctx = await requireStaff((await params).slug, { admin: true });
    if (!(await getModulosCached(ctx.barberia.id_barberia)).includes("ecommerce")) {
        return (
            <ModuloNoDisponible
                titulo="La tienda no está incluida en tu plan"
                descripcion="Cambia a un plan que lo incluya para activarlo."
                volverHref={`/${ctx.barberia.slug}/dashboard/suscripcion`}
                volverLabel="Ver planes"
            />
        );
    }

    const supabase = await createClient();
    const idBarberia = ctx.barberia.id_barberia;

    // Parse search params
    const resolvedSearchParams = await searchParams;
    const page = Number(resolvedSearchParams.page) || 1;
    const status = resolvedSearchParams.status as string | undefined;
    const delivery = resolvedSearchParams.delivery as string | undefined;
    const search = resolvedSearchParams.search as string | undefined;
    const ITEMS_PER_PAGE = 10;

    // Build query
    let query = supabase
        .from("pedido")
        .select(`
            id:id_pedido,
            created_at,
            estado,
            estado_pago,
            monto_total,
            tipo_entrega,
            direccion_envio,
            cliente:usuario!pedido_cliente_fkey (
                nombre,
                apellido,
                email
            ),
            detalle_pedido!detalle_pedido_pedido_fkey (
                id:id_detalle,
                cantidad,
                precio_unitario,
                subtotal,
                producto:producto!detalle_pedido_producto_fkey (
                    nombre,
                    precio,
                    imagen_url
                )
            )
        `, { count: 'exact' })
        .eq("id_barberia", idBarberia);

    // Apply filters
    if (status && status !== "all") {
        query = query.eq("estado", status);
    }

    if (delivery && delivery !== "all") {
        query = query.eq("tipo_entrega", delivery);
    }

    // Search by order ID (searching on the client's name would need a view or RPC)
    if (search && !isNaN(Number(search))) {
        query = query.eq("id_pedido", Number(search));
    }

    // Apply pagination
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data: pedidos, error, count } = await query
        .order("id_pedido", { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error fetching orders:", JSON.stringify(error, null, 2));
    }

    // Total sales: paid orders only (not filtered)
    const { data: paidOrders } = await supabase
        .from("pedido")
        .select("monto_total")
        .eq("id_barberia", idBarberia)
        .eq("estado_pago", "pagado");

    const totalSales = paidOrders?.reduce((acc, sale) => acc + Number(sale.monto_total || 0), 0) || 0;

    const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0;

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Gestión de Pedidos</h1>
            <PedidosClient
                initialOrders={pedidos || []}
                totalPages={totalPages}
                currentPage={page}
                totalOrders={count || 0}
                totalSales={totalSales}
            />
        </div>
    );
}
