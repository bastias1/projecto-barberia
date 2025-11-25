"use client";
import { useState, useEffect } from "react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, Store, Truck } from "lucide-react";
import { useCartStore } from "../../lib/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/utils/supabase/client";

type Address = {
  id: string;
  calle: string;
  ciudad: string;
  comuna: string;
  telefono: string;
  nombre_etiqueta?: string;
};

export default function CheckoutPage() {
  const cart = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const router = useRouter();
  const supabase = createClient();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // State
  const [step, setStep] = useState<'delivery' | 'payment'>('delivery');
  const [deliveryMethod, setDeliveryMethod] = useState<'retiro' | 'despacho'>('retiro');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  // New Address Form
  const [newAddress, setNewAddress] = useState({
    calle: '',
    ciudad: '',
    comuna: '',
    telefono: ''
  });

  // Initialize MP
  useEffect(() => {
    initMercadoPago("APP_USR-b3031121-06fe-4e47-a4bf-6df94bcdddbb", {
      locale: "es-CL",
    });
  }, []);

  // Fetch Addresses
  useEffect(() => {
    const fetchAddresses = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/checkout");
        return;
      }

      const { data } = await supabase
        .from('direccion_usuario')
        .select('*')
        .eq('usuario_id', user.id);

      if (data) setAddresses(data);
    };
    fetchAddresses();
  }, [router, supabase]);

  const handleSaveAddress = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('direccion_usuario')
      .insert({
        usuario_id: user.id,
        ...newAddress
      })
      .select()
      .single();

    if (data) {
      setAddresses([...addresses, data]);
      setSelectedAddressId(data.id);
      setShowNewAddressForm(false);
    }
    setIsLoading(false);
  };

  const handleCreatePreference = async () => {
    setIsLoading(true);
    try {
      const selectedAddress = addresses.find(a => a.id === selectedAddressId);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            id: item.id,
            title: item.name,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          delivery_method: deliveryMethod,
          shipping_address: deliveryMethod === 'despacho' ? selectedAddress : null
        }),
      });

      if (response.status === 401) {
        router.push("/login?redirect=/checkout");
        return;
      }

      const data = await response.json();
      if (data.id) {
        setPreferenceId(data.id);
        setStep('payment');
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect to cart if empty
  useEffect(() => {
    if (cart.length === 0) {
      router.push('/cart');
    }
  }, [cart.length, router]);

  if (cart.length === 0) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-4xl">
      <Link
        href="/cart"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver al carrito</span>
      </Link>

      <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        Checkout
      </h1>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Step 1: Delivery Method */}
          <Card className={step === 'payment' ? 'opacity-50 pointer-events-none' : ''}>
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
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-zinc-200 bg-transparent p-4 hover:bg-zinc-100 hover:text-zinc-900 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-zinc-50 [&:has([data-state=checked])]:border-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:peer-data-[state=checked]:border-zinc-100 dark:peer-data-[state=checked]:bg-zinc-900 cursor-pointer"
                  >
                    <Store className="mb-3 h-6 w-6" />
                    Retiro en Tienda
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="despacho" id="despacho" className="peer sr-only" />
                  <Label
                    htmlFor="despacho"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-zinc-200 bg-transparent p-4 hover:bg-zinc-100 hover:text-zinc-900 peer-data-[state=checked]:border-zinc-900 peer-data-[state=checked]:bg-zinc-50 [&:has([data-state=checked])]:border-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:peer-data-[state=checked]:border-zinc-100 dark:peer-data-[state=checked]:bg-zinc-900 cursor-pointer"
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
            <Card className={step === 'payment' ? 'opacity-50 pointer-events-none' : ''}>
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
                          <div className="text-sm text-zinc-500">{addr.comuna}, {addr.ciudad}</div>
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
                  <div className="space-y-4 border p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Calle y Número</Label>
                        <Input value={newAddress.calle} onChange={e => setNewAddress({ ...newAddress, calle: e.target.value })} placeholder="Av. Siempre Viva 123" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Comuna</Label>
                          <Input value={newAddress.comuna} onChange={e => setNewAddress({ ...newAddress, comuna: e.target.value })} placeholder="Providencia" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Ciudad</Label>
                          <Input value={newAddress.ciudad} onChange={e => setNewAddress({ ...newAddress, ciudad: e.target.value })} placeholder="Santiago" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Teléfono</Label>
                        <Input value={newAddress.telefono} onChange={e => setNewAddress({ ...newAddress, telefono: e.target.value })} placeholder="+569..." />
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
          {step === 'payment' && (
            <Card className="animate-in fade-in slide-in-from-bottom-4">
              <CardHeader>
                <CardTitle>Pago</CardTitle>
              </CardHeader>
              <CardContent>
                {!isWalletReady && (
                  <div className="w-full h-12 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-md" />
                )}
                <div className={!isWalletReady ? 'hidden' : 'block'}>
                  {preferenceId && (
                    <Wallet
                      initialization={{ preferenceId: preferenceId }}
                      onReady={() => setIsWalletReady(true)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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
                    <div className="relative h-16 w-16 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                      <Image
                        src={item.image || '/placeholder.png'}
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
                  <span>${Math.round(total / 1.19).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span>${Math.round(total - (total / 1.19)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total</span>
                  <span>${total.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground text-right pt-1">
                  * Precios incluyen IVA
                </p>
              </div>

              {step === 'delivery' && (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreatePreference}
                  disabled={isLoading || (deliveryMethod === 'despacho' && !selectedAddressId)}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continuar al Pago
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
