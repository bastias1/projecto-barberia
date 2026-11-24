"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizarRut } from "@/lib/rut";

// MercadoPago.js v2 (https://sdk.mercadopago.com/js/v2): solo lo que usa este formulario
type CardForm = { createCardToken: () => Promise<{ token?: string } | undefined>; unmount: () => void };
type MercadoPagoJs = new (publicKey: string, options?: { locale?: string }) => {
  cardForm: (options: Record<string, unknown>) => CardForm;
};
declare global {
  interface Window {
    MercadoPago?: MercadoPagoJs;
    /** Device ID del comprador: MercadoPago.js v2 lo crea solo al cargar. */
    MP_DEVICE_SESSION_ID?: string;
  }
}

export interface DatosTarjeta {
  token: string;
  paymentMethodId: string;
  paymentMethodType: string;
  /** Va al servidor para enviarlo a Mercado Pago (mejora la aprobación). */
  deviceId?: string;
  /** RUT ya validado, solo con `pedirRut`: el servidor lo reenvía a Mercado Pago y no lo guarda. */
  rut?: string;
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
const CAMPOS_SEGUROS = [
  { id: "form-checkout__cardNumber", labelId: "card-number-label" },
  { id: "form-checkout__expirationDate", labelId: "expiration-label" },
  { id: "form-checkout__securityCode", labelId: "security-code-label" },
];
const ERROR_CAMPOS = "No se pudieron cargar los campos de la tarjeta. Recarga la página o desactiva el bloqueador de anuncios.";

// Host vacío de un iframe seguro: con alto, posición relativa y el iframe ocupando todo
const secureHost =
  "relative h-11 w-full overflow-hidden rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full";

/**
 * Formulario de tarjeta con el CardForm de MercadoPago.js (tienda y suscripción).
 * `onPagar` recibe el token de un solo uso; devuelve un mensaje de error o null
 * si ya navegó a otra pantalla.
 */
export function FormularioTarjeta({
  monto,
  textoBoton,
  nota,
  datosBoton,
  pedirRut = false,
  onPagar,
}: {
  monto: number;
  textoBoton: string;
  nota: string;
  datosBoton?: Record<`data-${string}`, string>;
  /** Pide el RUT del titular y lo valida; solo la tienda (la suscripción no lo necesita). */
  pedirRut?: boolean;
  onPagar: (datos: DatosTarjeta) => Promise<string | null>;
}) {
  const [sdkListo, setSdkListo] = useState(false);
  const [errorInicio, setErrorInicio] = useState<string | null>(PUBLIC_KEY ? null : "Falta configurar NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Medio de pago de la tarjeta escrita (id y tipo de la misma respuesta del SDK)
  const metodo = useRef<{ id: string; tipo: string } | null>(null);
  const validando = useRef(false);
  const enviandoRef = useRef(false);
  const rutRef = useRef<HTMLInputElement>(null);
  // El CardForm se monta una vez; el callback más reciente se lee desde el ref
  const onPagarRef = useRef(onPagar);
  useEffect(() => {
    onPagarRef.current = onPagar;
  });

  useEffect(() => {
    // El script ya puede estar cargado al volver a esta pantalla
    if (window.MercadoPago) setSdkListo(true);
  }, []);

  useEffect(() => {
    if (!sdkListo || !PUBLIC_KEY || !window.MercadoPago) return;

    const mp = new window.MercadoPago(PUBLIC_KEY, { locale: "es-CL" });
    const cardForm = mp.cardForm({
      // CLP no tiene decimales
      amount: String(Math.round(monto)),
      iframe: true,
      form: {
        id: "form-checkout",
        cardNumber: { id: "form-checkout__cardNumber", placeholder: "1234 1234 1234 1234" },
        expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/AA" },
        securityCode: { id: "form-checkout__securityCode", placeholder: "CVV" },
        cardholderName: { id: "form-checkout__cardholderName" },
        issuer: { id: "form-checkout__issuer" },
        installments: { id: "form-checkout__installments" },
        identificationType: { id: "form-checkout__identificationType" },
        // El RUT no va al token (Mercado Pago lo rechaza con 324 invalid identificationNumber): el servidor lo envía en payer.identification
      },
      callbacks: {
        onFormMounted: (err: unknown) => {
          if (err) {
            console.error("[MercadoPago] onFormMounted:", err);
            setErrorInicio(ERROR_CAMPOS);
            return;
          }
          requestAnimationFrame(() => {
            const fallas = CAMPOS_SEGUROS.filter(({ id, labelId }) => {
              const host = document.getElementById(id);
              const rect = host?.getBoundingClientRect();
              return !host || host.querySelectorAll("iframe").length !== 1 || !rect?.width || !rect?.height || !document.getElementById(labelId);
            });
            if (fallas.length) {
              console.error("[MercadoPago] Campos seguros sin montar:", fallas.map((f) => f.id));
              setErrorInicio(ERROR_CAMPOS);
            }
          });
        },
        // Al cambiar el número, el medio de pago de la tarjeta anterior deja de valer
        // hasta que el SDK consulta el del nuevo BIN
        onBinChange: () => {
          metodo.current = null;
          validando.current = true;
        },
        onPaymentMethodsReceived: (err: unknown, metodos?: { id?: string; payment_type_id?: string }[]) => {
          const m = metodos?.[0];
          metodo.current = !err && m?.id ? { id: m.id, tipo: m.payment_type_id ?? "credit_card" } : null;
          validando.current = false;
        },
        onSubmit: async (event: Event) => {
          event.preventDefault();
          if (enviandoRef.current) return;
          enviandoRef.current = true;
          setEnviando(true);
          setError(null);
          try {
            let rut: string | undefined;
            if (pedirRut) {
              rut = normalizarRut(rutRef.current?.value) ?? undefined;
              if (!rut) {
                setError("Ingresa un RUT válido, por ejemplo 12.345.678-5.");
                return;
              }
            }
            // Un token nuevo en cada intento: es de un solo uso
            const nuevo = await cardForm.createCardToken().catch(() => undefined);
            if (nuevo?.token && validando.current) {
              setError("Estamos validando la tarjeta. Intenta de nuevo en un momento.");
              return;
            }
            if (!nuevo?.token || !metodo.current) {
              setError("Revisa los datos de la tarjeta.");
              return;
            }
            setError(await onPagarRef.current({
              token: nuevo.token, paymentMethodId: metodo.current.id, paymentMethodType: metodo.current.tipo,
              deviceId: window.MP_DEVICE_SESSION_ID, rut,
            }));
          } catch {
            setError("No se pudo conectar. Revisa tu conexión e intenta nuevamente.");
          } finally {
            enviandoRef.current = false;
            setEnviando(false);
          }
        },
      },
    });

    return () => cardForm.unmount();
  }, [sdkListo, monto, pedirRut]);

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setSdkListo(true)}
        onError={() => setErrorInicio("No se pudo cargar Mercado Pago. Revisa tu conexión o desactiva el bloqueador de anuncios.")}
      />

      <div
        id="checkout-init-error"
        role="alert"
        aria-live="assertive"
        hidden={!errorInicio}
        className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        {errorInicio}
      </div>

      <form
        id="form-checkout"
        className="grid gap-4"
        data-mp-public-key-source="framework-public-config"
        data-mp-payer-email-source="application"
        data-mp-payer-identification-source="application"
      >
        <div className="grid gap-2" data-mp-field="cardNumber" role="group" aria-labelledby="card-number-label">
          <span id="card-number-label" className="text-sm font-medium">Número de tarjeta</span>
          <div id="form-checkout__cardNumber" data-mp-secure-field="cardNumber" className={secureHost} aria-labelledby="card-number-label" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2" data-mp-field="expirationDate" role="group" aria-labelledby="expiration-label">
            <span id="expiration-label" className="text-sm font-medium">Vencimiento (MM/AA)</span>
            <div id="form-checkout__expirationDate" data-mp-secure-field="expirationDate" className={secureHost} aria-labelledby="expiration-label" />
          </div>
          <div className="grid gap-2" data-mp-field="securityCode" role="group" aria-labelledby="security-code-label">
            <span id="security-code-label" className="text-sm font-medium">Código de seguridad</span>
            <div id="form-checkout__securityCode" data-mp-secure-field="securityCode" className={secureHost} aria-labelledby="security-code-label" />
          </div>
        </div>

        <div className="grid gap-2" data-mp-field="cardholderName">
          <Label id="cardholder-name-label" htmlFor="form-checkout__cardholderName">Nombre del titular</Label>
          <Input id="form-checkout__cardholderName" aria-labelledby="cardholder-name-label" autoComplete="cc-name" placeholder="Como aparece en la tarjeta" required className="h-11" />
        </div>

        {pedirRut && (
          <div className="grid gap-2" data-mp-field="identificationNumber">
            <Label htmlFor="form-checkout__identificationNumber">RUT del titular</Label>
            <Input id="form-checkout__identificationNumber" ref={rutRef} autoComplete="off" placeholder="12.345.678-5" required className="h-11" />
          </div>
        )}

        {/* Nodos que exige el CardForm del SDK; el servidor fija 1 cuota */}
        <select id="form-checkout__issuer" data-mp-sdk-required-field="issuer" hidden aria-hidden="true" tabIndex={-1} />
        <select id="form-checkout__installments" data-mp-sdk-required-field="installments" hidden aria-hidden="true" tabIndex={-1} />
        <select id="form-checkout__identificationType" data-mp-sdk-required-field="identificationType" hidden aria-hidden="true" tabIndex={-1} />

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <p>{error}</p>
            {process.env.NODE_ENV !== "production" && (
              <p className="mt-1 text-xs opacity-80">
                Prueba: titular <strong>APRO</strong> para aprobar, <strong>FUND</strong> para fondos insuficientes.
              </p>
            )}
          </div>
        )}

        <Button type="submit" id="form-checkout__submit" size="lg" className="w-full" disabled={enviando || !sdkListo || !!errorInicio} {...datosBoton}>
          {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {enviando ? "Procesando pago…" : textoBoton}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{nota}</p>
      </form>
    </>
  );
}
