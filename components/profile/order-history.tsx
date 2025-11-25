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

interface Producto {
    nombre: string;
    precio: number;
    imagen_url: string | null;
}

interface DetalleVenta {
    id: number;
    cantidad: number;
    subtotal: number;
    producto: Producto;
}

interface Venta {
    id: number;
    fecha: string;
    hora: string;
    total: number;
    estado: string;
    estado_pago: string;
    tipo_entrega: string;
    direccion_envio: string | null;
    detalle_venta: DetalleVenta[];
}

export function OrderHistory() {
    const [orders, setOrders] = useState<Venta[]>([]);
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
                .from("venta")
                .select(`
                    *,
                    detalle_venta (
                        *,
                        producto:productos (
                            nombre,
                            precio,
                            imagen_url
                        )
                    )
                `)
                .eq("usuario", user.id)
                .order("id", { ascending: false });

            if (error) {
                console.error("Error fetching orders:", error);
                return;
            }

            setOrders(data || []);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completado
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendiente
                    </Badge>
                );
            case "cancelled":
                return (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelado
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getPaymentBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <Badge className="bg-green-500 text-white">Pagado</Badge>;
            case "pending":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pago Pendiente</Badge>;
            default:
                return <Badge variant="destructive">Pago {status}</Badge>;
        }
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
            <CardHeader>
                <CardTitle>Historial de Pedidos</CardTitle>
                <CardDescription>Revisa el estado de tus compras anteriores.</CardDescription>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="h-16 w-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
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
                                    <div className="h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                                        <Package className="h-6 w-6 text-zinc-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">Pedido #{order.id}</span>
                                            {getStatusBadge(order.estado)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(order.fecha), "dd MMM yyyy", { locale: es })}
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
                                        ${order.total.toLocaleString()}
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
                                                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                                    <span className="text-sm text-muted-foreground">Estado</span>
                                                    {getStatusBadge(order.estado)}
                                                </div>

                                                {/* Products */}
                                                <div>
                                                    <h4 className="font-semibold mb-3">Productos</h4>
                                                    <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                                        {order.detalle_venta?.map((detalle, index) => (
                                                            <div key={index} className="flex items-center gap-3">
                                                                <div className="relative h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden flex-shrink-0">
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
                                                                    ${detalle.subtotal.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Delivery Info */}
                                                {order.tipo_entrega === "despacho" && order.direccion_envio && (
                                                    <div>
                                                        <h4 className="font-semibold mb-2">Dirección de envío</h4>
                                                        <div className="text-sm bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md">
                                                            {typeof order.direccion_envio === 'string'
                                                                ? (() => {
                                                                    try {
                                                                        const address = JSON.parse(order.direccion_envio);
                                                                        return (
                                                                            <>
                                                                                <p>{address.calle}</p>
                                                                                <p>{address.comuna}, {address.ciudad}</p>
                                                                            </>
                                                                        );
                                                                    } catch (e) {
                                                                        return order.direccion_envio;
                                                                    }
                                                                })()
                                                                : "Dirección no disponible"
                                                            }
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Total */}
                                                <div className="pt-4 border-t">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold">Total</span>
                                                        <span className="text-xl font-bold">
                                                            ${order.total.toLocaleString()}
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
