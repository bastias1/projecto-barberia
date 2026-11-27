"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Package, Eye, Truck, ShoppingBag, CheckCircle2, Clock, XCircle } from "lucide-react";
import Image from "next/image";
import { ESTADO_PAGO, ESTADO_PEDIDO, parseDireccion } from "@/lib/pedido-estados";
import type { EstadoPagoPedido, EstadoPedido } from "@/lib/database.types";
import { formatCLP, formatFecha, toZoned } from "@/lib/datetime";

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

export interface PedidoCuenta {
    id: number;
    barberia: string | null; // null: la barbería ya no está activa
    created_at: string;
    monto_total: number;
    estado: EstadoPedido;
    estado_pago: EstadoPagoPedido;
    tipo_entrega: string;
    direccion_envio: string | null;
    detalle_pedido: DetallePedido[];
}

export function HistorialPedidos({ orders }: { orders: PedidoCuenta[] }) {
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

    return (
                    <div className="space-y-3">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="tarjeta flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                                        {order.detalle_pedido[0]?.producto?.imagen_url ? (
                                            <Image src={order.detalle_pedido[0].producto.imagen_url} alt="" fill sizes="56px" className="object-cover" />
                                        ) : (
                                            <Package className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">Pedido #{order.id}</span>
                                            {getStatusBadge(order.estado)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{order.barberia ?? "Barbería no disponible"}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-sm text-muted-foreground">
                                                {formatFecha(toZoned(order.created_at).fecha)}
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
                                        {formatCLP(order.monto_total)}
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
                                                                    {formatCLP(detalle.subtotal)}
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
                                                            {formatCLP(order.monto_total)}
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
    );
}
