"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Package, Truck, ShoppingBag, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

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

interface Usuario {
    nombre: string;
    apellido: string;
    correo: string;
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
    usuario: Usuario;
    detalle_venta: DetalleVenta[];
}

interface PedidosClientProps {
    initialOrders: any[];
    totalPages: number;
    currentPage: number;
    totalOrders: number;
}

export function PedidosClient({ initialOrders, totalPages, currentPage, totalOrders }: PedidosClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // State for filters
    const [orders, setOrders] = useState<Venta[]>(initialOrders);
    const [selectedOrder, setSelectedOrder] = useState<Venta | null>(null);

    // Update orders when initialOrders changes (server re-render)
    useEffect(() => {
        setOrders(initialOrders);
    }, [initialOrders]);

    // Filter handlers
    const createQueryString = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(name, value);

        // Reset to page 1 when filtering
        if (name !== "page") {
            params.set("page", "1");
        }

        return params.toString();
    };

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (term) {
            params.set("search", term);
        } else {
            params.delete("search");
        }
        params.set("page", "1");
        router.push(pathname + "?" + params.toString());
    }, 300);

    const handleStatusChange = (value: string) => {
        router.push(pathname + "?" + createQueryString("status", value));
    };

    const handleDeliveryChange = (value: string) => {
        router.push(pathname + "?" + createQueryString("delivery", value));
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("page", newPage.toString());
            router.push(pathname + "?" + params.toString());
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
            case "approved":
                return <Badge className="bg-green-500">Completado</Badge>;
            case "pending":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>;
            case "cancelled":
            case "rejected":
                return <Badge variant="destructive">Cancelado</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getDeliveryBadge = (type: string) => {
        return type === "despacho" ? (
            <Badge variant="secondary" className="gap-1">
                <Truck className="h-3 w-3" /> Delivery
            </Badge>
        ) : (
            <Badge variant="secondary" className="gap-1">
                <ShoppingBag className="h-3 w-3" /> Pickup
            </Badge>
        );
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Total Pedidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalOrders}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Ventas Totales (Vista Actual)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            ${orders.reduce((acc, order) => acc + order.total, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por ID de pedido..."
                        className="pl-8"
                        defaultValue={searchParams.get("search")?.toString()}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
                <Select
                    defaultValue={searchParams.get("status")?.toString() || "all"}
                    onValueChange={handleStatusChange}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    defaultValue={searchParams.get("delivery")?.toString() || "all"}
                    onValueChange={handleDeliveryChange}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Tipo de Entrega" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        <SelectItem value="despacho">Delivery</SelectItem>
                        <SelectItem value="retiro">Pickup</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Orders Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Entrega</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No hay pedidos registrados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">#{order.id}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {order.usuario?.nombre} {order.usuario?.apellido}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {order.usuario?.correo}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{format(new Date(order.fecha), "dd MMM yyyy", { locale: es })}</span>
                                                <span className="text-xs text-muted-foreground">{order.hora}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getDeliveryBadge(order.tipo_entrega)}</TableCell>
                                        <TableCell>{getStatusBadge(order.estado)}</TableCell>
                                        <TableCell className="font-bold">
                                            ${order.total.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setSelectedOrder(order)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Detalles del Pedido #{order.id}</DialogTitle>
                                                    </DialogHeader>

                                                    <div className="grid grid-cols-2 gap-6 py-4">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <h3 className="font-semibold mb-2">Información del Cliente</h3>
                                                                <p className="text-sm">{order.usuario?.nombre} {order.usuario?.apellido}</p>
                                                                <p className="text-sm text-muted-foreground">{order.usuario?.correo}</p>
                                                            </div>
                                                            <div>
                                                                <h3 className="font-semibold mb-2">Información de Entrega</h3>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    {getDeliveryBadge(order.tipo_entrega)}
                                                                </div>
                                                                {order.direccion_envio && (
                                                                    <div className="text-sm bg-muted p-3 rounded-md">
                                                                        {/* Parse JSON if it's a string, or display as is */}
                                                                        {typeof order.direccion_envio === 'string'
                                                                            ? (() => {
                                                                                try {
                                                                                    const address = JSON.parse(order.direccion_envio);
                                                                                    return (
                                                                                        <>
                                                                                            <p>{address.street_name} {address.street_number}</p>
                                                                                            <p>{address.city_name}, {address.state_name}</p>
                                                                                            <p>{address.zip_code}</p>
                                                                                        </>
                                                                                    );
                                                                                } catch (e) {
                                                                                    return order.direccion_envio;
                                                                                }
                                                                            })()
                                                                            : "Dirección no disponible"
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-semibold mb-4">Productos</h3>
                                                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                                                {order.detalle_venta?.map((detalle, index) => (
                                                                    <div key={index} className="flex items-start gap-3 border-b pb-3 last:border-0">
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
                                                                            <p className="text-sm font-medium">{detalle.producto?.nombre || "Producto eliminado"}</p>
                                                                            <div className="flex justify-between items-center mt-1">
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Cant: {detalle.cantidad}
                                                                                </span>
                                                                                <span className="text-sm font-medium">
                                                                                    ${detalle.subtotal.toLocaleString()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="mt-4 pt-4 border-t flex justify-between items-center">
                                                                <span className="font-bold">Total</span>
                                                                <span className="text-xl font-bold">${order.total.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Anterior
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
