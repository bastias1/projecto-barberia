"use client";
import { useState, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, MapPin, Store, Truck } from "lucide-react";
import { useBarberiaCart } from "@/lib/cart-store";
import { useBarberia } from "@/components/barberia-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormularioTarjeta, type DatosTarjeta } from "@/components/pagos/formulario-tarjeta";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

type Address = {
  id: string;
  calle: string;
  ciudad: string;
  comuna: string;
  telefono: string;
  nombre_etiqueta?: string;
};

const sinSuscripcion = () => () => {};

export default function CheckoutPage() {
  const { slug } = useBarberia();
  const { items: cart } = useBarberiaCart();
  const router = useRouter();
  const loginUrl = `/login?barberia=${slug}&next=/${slug}/checkout`;
  const supabase = createClient();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // State
  const [deliveryMethod, setDeliveryMethod] = useState<'retiro' | 'despacho'>('retiro');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Pedido creado al pagar; se reutiliza en un reintento si la entrega no cambió
  const [pedido, setPedido] = useState<{ id: number; monto: number; entrega: string } | null>(null);
  const entrega = deliveryMethod === 'despacho' ? `despacho:${selectedAddressId}` : 'retiro';
  // Tras crear el pedido manda su total (precios vigentes), no el guardado en el carrito
  const monto = pedido?.monto ?? total;

  // New Address Form
  const [newAddress, setNewAddress] = useState({
    calle: '',
    ciudad: '',
    comuna: '',
    telefono: ''
  });

  // Fetch Addresses
  useEffect(() => {
    const fetchAddresses = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(loginUrl);
        return;
      }

      const { data } = await supabase
        .from('direccion_usuario')
        .select('id:id_direccion, calle, ciudad, comuna, telefono, nombre_etiqueta, depto, region')
        .eq('id_usuario', user.id);

      if (data) setAddresses(data);
    };
    fetchAddresses();
  }, [router, supabase, loginUrl]);

  const handleSaveAddress = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('direccion_usuario')
      .insert({
        id_usuario: user.id,
        ...newAddress
      })
      .select('id:id_direccion, calle, ciudad, comuna, telefono, nombre_etiqueta, depto, region')
      .single();

    if (error) {
      toast.error('No se pudo guardar la dirección');
    }
    if (data) {
      setAddresses([...addresses, data]);
      setSelectedAddressId(data.id);
      setShowNewAddressForm(false);
    }
    setIsLoading(false);
  };

  // Crea el pedido (reserva stock) solo al pagar y luego cobra la tarjeta
  const pagar = async (datos: DatosTarjeta): Promise<string | null> => {
    if (deliveryMethod === 'despacho' && !selectedAddressId) return 'Elige una dirección de despacho.';

    let actual = pedido;
    if (actual && actual.entrega !== entrega) {
      // Cancelar devuelve el stock del pedido anterior
      const { error } = await supabase.from('pedido').update({ estado: 'cancelado' }).eq('id_pedido', actual.id);
      if (error) return 'No se pudo actualizar el pedido. Recarga la página e intenta nuevamente.';
      setPedido(null);
      actual = null;
    }

    if (!actual) {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberia: slug,
          items: cart.map((item) => ({
            id: item.id,
            title: item.name,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          delivery_method: deliveryMethod,
          shipping_address: deliveryMethod === 'despacho' ? addresses.find(a => a.id === selectedAddressId) : null
        }),
      });
      if (response.status === 401) {
        router.push(loginUrl);
        return null;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return data.error || 'No se pudo crear el pedido';

      actual = { id: data.pedido, monto: data.monto, entrega };
      setPedido(actual);
      if (actual.monto !== total) return 'El precio de algún producto cambió. Revisa el nuevo total y vuelve a pagar.';
    }

    const res = await fetch("/api/checkout/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberia: slug, pedido: actual.id, ...datos }),
    });
    if (res.status === 401) {
      router.push(loginUrl);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    if (data.estado === "aprobado") {
      router.push(`/${slug}/checkout/success?pedido=${actual.id}`);
      return null;
    }
    if (data.estado === "pendiente") {
      router.push(`/${slug}/checkout/pending`);
      return null;
    }
    // Un pago rechazado deja el pedido pendiente para reintentar con otra tarjeta
    return data.error || "No se pudo procesar el pago. Intenta nuevamente.";
  };

  // Al hidratar, el carrito sale vacío (snapshot del servidor) hasta el render siguiente
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  // Redirect to cart if empty
  useEffect(() => {
    if (montado && cart.length === 0) {
      router.push(`/${slug}/cart`);
    }
  }, [montado, cart.length, router, slug]);

  if (cart.length === 0) {
    return null;
  }

  return (
    <main id="contenido" className="mx-auto w-full max-w-4xl">
      <Link
        href={`/${slug}/cart`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver al carrito</span>
      </Link>

      <h1 className="display mb-8 text-3xl sm:text-4xl">
        Checkout
      </h1>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Step 1: Delivery Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Método de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={deliveryMethod} onValueChange={(v: 'retiro' | 'despacho') => setDeliveryMethod(v)} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="retiro" id="retiro" className="peer sr-only" />
                  <Label
                    htmlFor="retiro"
                    className="flex min-h-20 flex-col items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Store className="mb-3 h-6 w-6" />
                    Retiro en Tienda
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="despacho" id="despacho" className="peer sr-only" />
                  <Label
                    htmlFor="despacho"
                    className="flex min-h-20 flex-col items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Truck className="mb-3 h-6 w-6" />
                    Despacho a Domicilio
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Step 2: Address (Only for Despacho) */}
          {deliveryMethod === 'despacho' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {addresses.length > 0 && (
                  <RadioGroup value={selectedAddressId || ''} onValueChange={setSelectedAddressId}>
                    {addresses.map((addr) => (
                      <div key={addr.id} className="flex items-center space-x-2 border p-3 rounded-lg">
                        <RadioGroupItem value={addr.id} id={addr.id} />
                        <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                          <div className="font-medium">{addr.calle}</div>
                          <div className="text-sm text-muted-foreground">{addr.comuna}, {addr.ciudad}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {!showNewAddressForm ? (
                  <Button variant="outline" onClick={() => setShowNewAddressForm(true)} className="w-full">
                    + Agregar Nueva Dirección
                  </Button>
                ) : (
                  <div className="space-y-4 border border-border p-4 rounded-xl bg-muted/50">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="direccion-calle">Calle y Número</Label>
                        <Input id="direccion-calle" value={newAddress.calle} onChange={e => setNewAddress({ ...newAddress, calle: e.target.value })} placeholder="Av. Siempre Viva 123" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="direccion-comuna">Comuna</Label>
                          <Input id="direccion-comuna" value={newAddress.comuna} onChange={e => setNewAddress({ ...newAddress, comuna: e.target.value })} placeholder="Providencia" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="direccion-ciudad">Ciudad</Label>
                          <Input id="direccion-ciudad" value={newAddress.ciudad} onChange={e => setNewAddress({ ...newAddress, ciudad: e.target.value })} placeholder="Santiago" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="direccion-telefono">Teléfono</Label>
                        <Input id="direccion-telefono" value={newAddress.telefono} onChange={e => setNewAddress({ ...newAddress, telefono: e.target.value })} placeholder="+569..." />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveAddress} disabled={isLoading}>Guardar Dirección</Button>
                      <Button variant="ghost" onClick={() => setShowNewAddressForm(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Tarjeta de crédito o débito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormularioTarjeta
                monto={monto}
                textoBoton={`Pagar $${monto.toLocaleString("es-CL")}`}
                nota="Pago procesado de forma segura por Mercado Pago. 1 cuota."
                datosBoton={{ "data-mp-checkout-cta": "checkout-api" }}
                onPagar={pagar}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="md:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Resumen de Compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item List */}
              <div className="space-y-3 border-b pb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <Image
                        src={item.image || '/placeholder.svg'}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                      <p className="text-sm font-medium">${(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${Math.round(monto / 1.19).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span>${Math.round(monto - (monto / 1.19)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total</span>
                  <span>${monto.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground text-right pt-1">
                  * Precios incluyen IVA
                </p>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
