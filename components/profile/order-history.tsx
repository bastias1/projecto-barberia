"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Package, Eye, Truck, ShoppingBag, CheckCircle2, Clock, XCircle } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { ESTADO_PAGO, ESTADO_PEDIDO, parseDireccion } from "@/lib/pedido-estados";
import type { EstadoPagoPedido, EstadoPedido } from "@/lib/database.types";
import { one } from "@/lib/utils";
import { Vidrio } from "@/components/vidrio";

interface Producto {
    nombre: string;
    precio: number;
    imagen_url: string | null;
}

interface DetallePedido {
    id: number;
    cantidad: number;
    subtotal: number;
    producto: Producto | null;
}

interface Pedido {
    id: number;
    created_at: string;
    monto_total: number;
    estado: EstadoPedido;
    estado_pago: EstadoPagoPedido;
    tipo_entrega: string;
    direccion_envio: string | null;
    detalle_pedido: DetallePedido[];
}

export function OrderHistory({ idBarberia }: { idBarberia: string }) {
    const [orders, setOrders] = useState<Pedido[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("pedido")
                .select(`
                    id:id_pedido, created_at, monto_total, estado, estado_pago, tipo_entrega, direccion_envio,
                    detalle_pedido!detalle_pedido_pedido_fkey (
                        id:id_detalle, cantidad, subtotal,
                        producto:producto!detalle_pedido_producto_fkey (
                            nombre,
                            precio,
                            imagen_url
                        )
                    )
                `)
                .eq("id_cliente", user.id)
                .eq("id_barberia", idBarberia)
                .order("id_pedido", { ascending: false });

            if (error) {
                console.error("Error fetching orders:", error);
                return;
            }

            type PedidoRow = Omit<Pedido, "detalle_pedido"> & {
                detalle_pedido: Array<Omit<DetallePedido, "producto"> & { producto: unknown }> | null;
            };
            setOrders(((data || []) as unknown as PedidoRow[]).map((o) => ({
                ...o,
                detalle_pedido: (o.detalle_pedido ?? []).map((d) => ({ ...d, producto: one<Producto>(d.producto) })),
            })));
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: EstadoPedido) => {
        const estado = ESTADO_PEDIDO[status];
        if (!estado) return <Badge variant="secondary">{status}</Badge>;
        const Icon = status === "entregado" ? CheckCircle2 : status === "cancelado" ? XCircle : Clock;
        return (
            <Badge className={estado.className}>
                <Icon className="h-3 w-3 mr-1" />
                {estado.label}
            </Badge>
        );
    };

    const getPaymentBadge = (status: EstadoPagoPedido) => {
        const estado = ESTADO_PAGO[status];
        return estado
            ? <Badge className={estado.className}>{estado.label}</Badge>
            : <Badge variant="secondary">{status}</Badge>;
    };

    const getDeliveryIcon = (type: string) => {
        return type === "despacho" ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Truck className="h-3 w-3" /> Despacho
            </div>
        ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShoppingBag className="h-3 w-3" /> Retiro
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <Card>
          <Vidrio />
            <CardHeader>
                <CardTitle>Historial de Pedidos</CardTitle>
                <CardDescription>Revisa el estado de tus compras anteriores.</CardDescription>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No tienes pedidos</h3>
                        <p className="text-muted-foreground text-sm">
                            Cuando realices una compra, aparecerá aquí.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">Pedido #{order.id}</span>
                                            {getStatusBadge(order.estado)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(order.created_at), "dd MMM yyyy", { locale: es })}
                                            </span>
                                            <span className="text-muted-foreground">•</span>
                                            {getDeliveryIcon(order.tipo_entrega)}
                                            <span className="text-muted-foreground">•</span>
                                            {getPaymentBadge(order.estado_pago)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-lg">
                                        ${Number(order.monto_total).toLocaleString("es-CL")}
                                    </span>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Eye className="h-4 w-4 mr-1" />
                                                Ver
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Pedido #{order.id}</DialogTitle>
                                            </DialogHeader>

                                            <div className="space-y-4 py-4">
                                                {/* Order Status */}
                                                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                    <span className="text-sm text-muted-foreground">Estado</span>
                                                    {getStatusBadge(order.estado)}
                                                </div>

                                                {/* Products */}
                                                <div>
                                                    <h4 className="font-semibold mb-3">Productos</h4>
                                                    <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                                        {order.detalle_pedido?.map((detalle, index) => (
                                                            <div key={index} className="flex items-center gap-3">
                                                                <div className="relative h-12 w-12 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                                                    {detalle.producto?.imagen_url ? (
                                                                        <Image
                                                                            src={detalle.producto.imagen_url}
                                                                            alt={detalle.producto.nombre}
                                                                            fill
                                                                            className="object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center h-full">
                                                                            <Package className="h-4 w-4 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium">
                                                                        {detalle.producto?.nombre || "Producto"}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Cant: {detalle.cantidad}
                                                                    </p>
                                                                </div>
                                                                <span className="text-sm font-medium">
                                                                    ${Number(detalle.subtotal).toLocaleString("es-CL")}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Delivery Info */}
                                                {order.tipo_entrega === "despacho" && order.direccion_envio && (
                                                    <div>
                                                        <h4 className="font-semibold mb-2">Dirección de envío</h4>
                                                        <div className="text-sm bg-muted p-3 rounded-md">
                                                            {parseDireccion(order.direccion_envio)?.lineas.map((linea, i) => (
                                                                <p key={i}>{linea}</p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Total */}
                                                <div className="pt-4 border-t">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold">Total</span>
                                                        <span className="text-xl font-bold">
                                                            ${Number(order.monto_total).toLocaleString("es-CL")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
