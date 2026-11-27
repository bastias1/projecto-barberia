import type { Metadata } from "next";
import Link from "next/link";
import { PLATAFORMA, VERSION_POLITICA } from "@/lib/plataforma";
import { DIAS_PRUEBA } from "@/lib/planes";

// BORRADOR: requiere revisión legal antes de producción (Ley 19.496, Ley 19.628 / 21.719).
// Los [COMPLETAR] son datos que no están en el código y no se deben inventar.

export const metadata: Metadata = { title: `Términos de servicio - ${PLATAFORMA.nombre}` };

export default function TerminosPage() {
  const correo = PLATAFORMA.emailContacto;
  return (
    <>
      <h1>Términos de servicio</h1>
      <p className="text-sm text-muted-foreground">Versión {VERSION_POLITICA} · Vigente desde [COMPLETAR: fecha]</p>

      <h2>1. Qué es {PLATAFORMA.nombre}</h2>
      <p>
        {PLATAFORMA.nombre} es un software en línea que ofrece [COMPLETAR: razón social], RUT [COMPLETAR], para que
        las barberías tengan su propia página con agenda de reservas, tienda y un panel de gestión. Al crear una
        cuenta, reservar, comprar o registrar una barbería aceptas estos términos y la{" "}
        <Link href="/privacidad">política de privacidad</Link>.
      </p>
      <ul>
        <li><strong>Plataforma</strong>: el software {PLATAFORMA.nombre} y quien lo ofrece.</li>
        <li><strong>Barbería</strong>: el negocio que contrata la plataforma y publica su página, servicios y productos.</li>
        <li><strong>Cliente</strong>: la persona que reserva o compra en una barbería.</li>
      </ul>

      <h2>2. Quién responde por qué</h2>
      <p>Cada barbería opera su propia página. La plataforma no presta los servicios de barbería ni vende los productos de la tienda.</p>
      <ul>
        <li>
          <strong>La barbería responde</strong> por sus servicios, precios, horarios, productos, stock, despachos,
          cambios y devoluciones, y por cumplir con sus clientes la Ley 19.496 de protección de los derechos de los
          consumidores. También por el contenido que publica (textos, logo, fotos) y por los datos de sus clientes.
        </li>
        <li>
          <strong>La plataforma responde</strong> por el funcionamiento del software, la seguridad de los datos que
          guarda y el cobro de la suscripción a la barbería.
        </li>
        <li>[COMPLETAR: quién recibe el dinero de las ventas de la tienda y cómo se liquida a cada barbería.]</li>
      </ul>

      <h2>3. Cuentas</h2>
      <ul>
        <li>Para crear una cuenta debes ser mayor de edad y dar datos verdaderos.</li>
        <li>Eres responsable de mantener tu contraseña en secreto y de lo que se haga con tu cuenta.</li>
        <li>Una misma cuenta puede ser cliente de una barbería y parte del equipo de otra.</li>
        <li>Puedes pedir que eliminemos tu cuenta y tus datos en <Link href="/eliminar-datos">Eliminar mis datos</Link>.</li>
      </ul>

      <h2>4. Reservas</h2>
      <ul>
        <li>Puedes reservar con cuenta o como invitado. La reserva queda registrada al confirmarla en el sitio y te llega un correo con links para confirmarla o cancelarla.</li>
        <li>Cada barbería puede bloquear a clientes que no asistan a sus reservas.</li>
        <li>
          <strong>Menores de edad:</strong> las reservas para menores de edad deben ser realizadas por un adulto
          responsable, con sus propios datos de contacto, quien responde por la reserva.
        </li>
      </ul>

      <h2>5. Compras en la tienda</h2>
      <ul>
        <li>Para comprar necesitas una cuenta. Los precios se muestran en pesos chilenos con IVA incluido.</li>
        <li>El pago se hace con tarjeta a través de Mercado Pago. La plataforma no guarda datos de tarjetas.</li>
        <li>Los cambios, devoluciones y garantías los gestiona la barbería. Ver <Link href="/reembolsos">Reembolsos</Link>.</li>
      </ul>

      <h2>6. Suscripción de las barberías</h2>
      <ul>
        <li>Cada cuenta tiene una única prueba gratis de {DIAS_PRUEBA} días, sin ingresar tarjeta y solo en el plan Pro. Los demás planes, y las barberías que registres después, se activan al pagar. Al terminar la prueba no se cobra nada automáticamente.</li>
        <li>Si la barbería elige un plan y lo paga, el cobro es mensual y automático a la tarjeta que ingresó, por el precio que se muestra al pagar. [COMPLETAR: confirmar si los precios incluyen IVA.]</li>
        <li>La suscripción se cancela en cualquier momento desde el panel (Suscripción → Cancelar suscripción). Se deja de cobrar y el plan sigue vigente hasta el fin del período pagado.</li>
        <li>Si un cobro falla o la suscripción vence, las funciones del plan se desactivan hasta regularizar el pago. Los datos de la barbería se conservan.</li>
        <li>Los cambios de precio se avisan con anticipación y no afectan el período ya pagado. [COMPLETAR: plazo de aviso.]</li>
      </ul>

      <h2>7. Uso permitido</h2>
      <p>No está permitido usar la plataforma para actividades ilegales, publicar contenido que infrinja derechos de terceros, enviar spam, intentar acceder a datos de otras barberías o afectar el funcionamiento del servicio.</p>

      <h2>8. Suspensión</h2>
      <p>
        Podemos suspender una cuenta o una barbería si incumple estos términos, si hay uso fraudulento o si la
        suscripción no está pagada. Cuando sea posible, avisaremos antes por correo e indicaremos el motivo.
      </p>

      <h2>9. Disponibilidad y limitaciones</h2>
      <p>
        Buscamos que el servicio esté disponible todo el tiempo, pero puede haber interrupciones por mantención o
        fallas de proveedores. La plataforma no responde por los servicios que presta cada barbería. Nada en estos
        términos limita los derechos irrenunciables que la Ley 19.496 otorga a los consumidores.
      </p>

      <h2>10. Contenido y propiedad intelectual</h2>
      <p>
        El software es de [COMPLETAR: titular]. El contenido que publica cada barbería (textos, logos, fotos) es de esa
        barbería, que declara tener derecho a usarlo y nos autoriza a mostrarlo en su página.
      </p>

      <h2>11. Cambios a estos términos</h2>
      <p>Publicaremos los cambios en esta página con su fecha. Si son relevantes, te avisaremos por correo o al iniciar sesión.</p>

      <h2>12. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de Chile. Cualquier conflicto se someterá a los tribunales de
        [COMPLETAR: ciudad], sin perjuicio del derecho de los consumidores a recurrir al tribunal de su domicilio y al
        SERNAC. Contacto: <a href={`mailto:${correo}`}>{correo}</a>.
      </p>

      <h2>13. Créditos y licencias</h2>
      <ul>
        <li>Tipografía <a href="https://vercel.com/font" rel="noopener noreferrer">Geist</a> de Vercel, bajo licencia SIL Open Font License 1.1.</li>
        <li>Íconos <a href="https://lucide.dev" rel="noopener noreferrer">Lucide</a>, bajo licencia ISC.</li>
        <li>Componentes basados en <a href="https://ui.shadcn.com" rel="noopener noreferrer">shadcn/ui</a> y Radix UI, bajo licencia MIT.</li>
        <li>Los logos, fotos y productos de cada barbería son de esa barbería.</li>
      </ul>
    </>
  );
}
