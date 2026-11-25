import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock, MapPin, Package, ShoppingBag, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { getBarberiaCached } from "@/lib/barberia-server";
import { getHorarioResumen, mapaEmbedUrl } from "@/lib/barberia-publica";
import { parseDireccion } from "@/lib/pedido-estados";
import { one } from "@/lib/utils";
import { VaciarCarrito } from "./vaciar-carrito";
import { Vidrio } from "@/components/vidrio";

type Producto = { nombre: string; imagen_url: string | null };
type Detalle = { id: number; cantidad: number; precio_unitario: number; subtotal: number; producto: unknown };
type Pedido = {
    id: number;
    monto_total: number;
    tipo_entrega: string;
    direccion_envio: string | null;
    id_sucursal: number | null;
    detalle_pedido: Detalle[] | null;
};

const clp = (n: number) => `$${Number(n).toLocaleString("es-CL")}`;

export default async function PaymentSuccessPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ pedido?: string }>;
}) {
    const { slug } = await params;
    const { pedido: idPedido } = await searchParams;
    const barberia = await getBarberiaCached(slug);
    if (!barberia) notFound();
    const supabase = await createClient();

    // RLS: el cliente solo ve sus propios pedidos
    const { data } = /^\d+$/.test(idPedido ?? "")
        ? await supabase
            .from("pedido")
            .select(`
                id:id_pedido, monto_total, tipo_entrega, direccion_envio, id_sucursal,
                detalle_pedido!detalle_pedido_pedido_fkey (
                    id:id_detalle, cantidad, precio_unitario, subtotal,
                    producto:producto!detalle_pedido_producto_fkey ( nombre, imagen_url )
                )
            `)
            .eq("id_barberia", barberia.id_barberia)
            .eq("id_pedido", Number(idPedido))
            .maybeSingle()
        : { data: null };
    const pedido = data as Pedido | null;

    const retiro = pedido?.tipo_entrega === "retiro";
    const [{ data: sucursal }, horario] = retiro && pedido.id_sucursal
        ? await Promise.all([
            supabase
                .from("sucursal")
                .select("nombre, direccion, comuna, telefono")
                .eq("id_barberia", barberia.id_barberia)
                .eq("id_sucursal", pedido.id_sucursal)
                .maybeSingle(),
            getHorarioResumen(supabase, barberia.id_barberia, pedido.id_sucursal),
        ])
        : [{ data: null }, []];
    const direccion = pedido?.tipo_entrega === "despacho" ? parseDireccion(pedido.direccion_envio) : null;

    // El fondo, el header y el padding los pone checkout/layout.tsx
    return (
        <main id="contenido" className="mx-auto w-full max-w-5xl space-y-4 pt-2">
            <VaciarCarrito />

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-accent p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-10 w-10 shrink-0" aria-hidden="true" />
                    <div>
                        <h1 className="text-xl font-bold">¡Pago exitoso!</h1>
                        <p className="text-sm text-muted-foreground">
                            {pedido
                                ? `Tu pedido #${pedido.id} en ${barberia.nombre} está confirmado.`
                                : "Tu compra ha sido procesada correctamente."}
                        </p>
                    </div>
                </div>
                {/* En móvil los botones van apilados, con el principal arriba */}
                <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                    {pedido && (
                        <Button asChild variant="outline">
                            <Link href={`/${slug}/profile`}>Ver mis pedidos</Link>
                        </Button>
                    )}
                    <Button asChild className="group">
                        <Link href={`/${slug}/tienda`}>
                            <ShoppingBag className="h-4 w-4" />
                            Seguir comprando
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                </div>
            </div>

            {pedido && (
                <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                    <Card className="gap-3 py-4">
                      <Vidrio />
                        <CardHeader className="px-4">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Package className="h-4 w-4" aria-hidden="true" /> Tu compra
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4">
                            {/* En computador la lista hace scroll propio para que la página no lo necesite */}
                            <ul className="divide-y lg:max-h-72 lg:overflow-y-auto">
                                {(pedido.detalle_pedido ?? []).map((d) => {
                                    const producto = one<Producto>(d.producto);
                                    return (
                                        <li key={d.id} className="flex items-center gap-3 py-2">
                                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                                                {producto?.imagen_url ? (
                                                    <Image src={producto.imagen_url} alt={producto.nombre} fill sizes="48px" className="object-cover" />
                                                ) : (
                                                    <ShoppingBag className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">{producto?.nombre ?? "Producto"}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {d.cantidad} × {clp(d.precio_unitario)}
                                                </p>
                                            </div>
                                            <p className="font-semibold">{clp(d.subtotal)}</p>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="mt-2 flex items-center justify-between border-t pt-3 text-lg font-bold">
                                <span>Total pagado</span>
                                <span>{clp(pedido.monto_total)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {retiro && (
                        <Card className="gap-3 py-4">
                          <Vidrio />
                            <CardHeader className="px-4">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Store className="h-4 w-4" aria-hidden="true" /> Retiro en tienda
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 px-4">
                                <p className="text-sm text-muted-foreground">
                                    Te avisaremos cuando tu pedido esté listo para retirar.
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {sucursal && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                            <div>
                                                <p className="font-medium">{sucursal.nombre}</p>
                                                <p className="text-muted-foreground">{sucursal.direccion}, {sucursal.comuna}</p>
                                                {sucursal.telefono && (
                                                    <a href={`tel:${sucursal.telefono.replace(/\s/g, "")}`} className="text-muted-foreground hover:text-foreground">
                                                        {sucursal.telefono}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {horario.length > 0 && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                            <div>
                                                <p className="font-medium">Horario de atención</p>
                                                {horario.map((tramo) => (
                                                    <p key={tramo.dias} className="text-muted-foreground">
                                                        {tramo.dias}: <span className="text-foreground">{tramo.horas}</span>
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {sucursal && (
                                    <div className="relative h-44 overflow-hidden rounded-lg">
                                        <iframe
                                            title={`Ubicación de ${sucursal.nombre} en Google Maps`}
                                            src={mapaEmbedUrl(`${sucursal.direccion}, ${sucursal.comuna}, Chile`)}
                                            className="absolute inset-0 h-full w-full border-0"
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {pedido.tipo_entrega === "despacho" && (
                        <Card className="gap-3 py-4">
                          <Vidrio />
                            <CardHeader className="px-4">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Truck className="h-4 w-4" aria-hidden="true" /> Despacho a domicilio
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 px-4">
                                <p className="text-sm text-muted-foreground">
                                    Prepararemos tu pedido y te avisaremos cuando sea enviado.
                                </p>
                                {direccion && (
                                    <div className="flex items-start gap-2 text-sm">
                                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                        <div>
                                            {direccion.lineas.map((linea, i) => (
                                                <p key={i} className={i === 0 ? "font-medium" : "text-muted-foreground"}>{linea}</p>
                                            ))}
                                            {direccion.telefono && <p className="text-muted-foreground">Tel: {direccion.telefono}</p>}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </main>
    );
}
