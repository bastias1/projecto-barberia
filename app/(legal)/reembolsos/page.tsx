import type { Metadata } from "next";
import Link from "next/link";
import { PLATAFORMA } from "@/lib/plataforma";

// BORRADOR: requiere revisión legal antes de producción (Ley 19.496: retracto, garantía legal).
// Los [COMPLETAR] son decisiones de negocio o datos que no están en el código.

export const metadata: Metadata = { title: `Cancelaciones y reembolsos - ${PLATAFORMA.nombre}` };

export default function ReembolsosPage() {
  const correo = PLATAFORMA.emailContacto;
  return (
    <>
      <h1>Cancelaciones y reembolsos</h1>

      <h2>Suscripción de las barberías</h2>
      <ul>
        <li>La prueba gratuita no pide tarjeta y no genera cobros.</li>
        <li>Puedes cancelar la suscripción cuando quieras desde el panel, en Suscripción → Cancelar suscripción, con la misma facilidad con que la contrataste. No se cobran cargos por cancelar.</li>
        <li>Al cancelar se detiene la renovación automática. El plan sigue activo hasta el final del período ya pagado.</li>
        <li>Reembolso del período en curso: [COMPLETAR: si se devuelve la parte no usada o no].</li>
        <li>Cobros duplicados o por error: escribe a <a href={`mailto:${correo}`}>{correo}</a> y lo devolvemos a la misma tarjeta. [COMPLETAR: plazo.]</li>
      </ul>

      <h2>Compras en la tienda de una barbería</h2>
      <ul>
        <li>Los productos los vende cada barbería, que gestiona los cambios, devoluciones y garantías. Contáctala usando los datos de su página.</li>
        <li>Si un pago fue rechazado, no se cobra nada y el pedido queda pendiente para que vuelvas a intentarlo.</li>
        <li>Si la barbería cancela un pedido pagado, el monto se devuelve a la tarjeta usada. [COMPLETAR: quién gestiona la devolución en Mercado Pago y en qué plazo.]</li>
        <li>Derecho de retracto y garantía legal: [COMPLETAR: revisar con asesoría legal cómo aplica la Ley 19.496 a las compras en línea de cada barbería.]</li>
      </ul>

      <h2>Reservas</h2>
      <ul>
        <li>Las reservas no se pagan por adelantado, así que no hay montos que reembolsar.</li>
        <li>Puedes cancelar una reserva con el link del correo de confirmación.</li>
      </ul>

      <p>¿Dudas? Revisa los <Link href="/terminos">términos de servicio</Link> o escríbenos a <a href={`mailto:${correo}`}>{correo}</a>.</p>
    </>
  );
}
