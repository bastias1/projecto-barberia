import type { Metadata } from "next";
import Link from "next/link";
import { PLATAFORMA, VERSION_POLITICA } from "@/lib/plataforma";

// BORRADOR: requiere revisión legal antes de producción (Ley 19.628 modificada por la Ley 21.719).
// Los [COMPLETAR] son datos que no están en el código y no se deben inventar.

export const metadata: Metadata = { title: `Política de privacidad - ${PLATAFORMA.nombre}` };

export default function PrivacidadPage() {
  const correo = PLATAFORMA.emailContacto;
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="text-sm text-muted-foreground">Versión {VERSION_POLITICA} · Vigente desde [COMPLETAR: fecha]</p>

      <h2>1. Quiénes somos y qué rol tenemos</h2>
      <p>
        {PLATAFORMA.nombre} es un software para barberías. Lo ofrece [COMPLETAR: razón social], RUT [COMPLETAR],
        con domicilio en [COMPLETAR: dirección], correo <a href={`mailto:${correo}`}>{correo}</a>.
      </p>
      <p>Cada barbería tiene su propia página dentro de la plataforma. Por eso hay dos roles distintos:</p>
      <ul>
        <li>
          <strong>Cada barbería es responsable</strong> de los datos de sus propios clientes (reservas, compras,
          reseñas, notas y bloqueos). Decide para qué los usa y es quien debe responder primero las solicitudes
          de sus clientes.
        </li>
        <li>
          <strong>{PLATAFORMA.nombre} actúa como proveedor (encargado)</strong> de esos datos: los guarda y procesa
          por cuenta de la barbería, solo para prestar el servicio. Además, {PLATAFORMA.nombre} es responsable de
          los datos de las cuentas de usuario y de las barberías que contratan el servicio.
        </li>
      </ul>

      <h2>2. Qué datos recogemos</h2>
      <h3>Dueños, administradores y barberos</h3>
      <ul>
        <li>Nombre, apellido, correo y contraseña (la contraseña se guarda cifrada por el proveedor de autenticación).</li>
        <li>Teléfono y foto de perfil, si los agregas.</li>
        <li>Datos de la barbería: nombre, dirección de sus sucursales, horarios, servicios, precios, productos, logo y galería.</li>
        <li>Datos de la suscripción: plan, fechas y estado de los pagos. Los datos de la tarjeta los recibe directamente Mercado Pago; nosotros no los guardamos.</li>
      </ul>
      <h3>Clientes de las barberías</h3>
      <ul>
        <li>Al reservar: nombre, apellido, correo y, si lo das, teléfono. También la fecha, el servicio y el barbero elegido.</li>
        <li>Si creas una cuenta: nombre, apellido, correo, contraseña y, si los agregas, teléfono y foto.</li>
        <li>Al comprar en la tienda: los productos, el pago (solo su resultado y su identificador, nunca la tarjeta) y, si pides despacho, la dirección y un teléfono de contacto.</li>
        <li>Si dejas una reseña: la calificación y el comentario.</li>
        <li>El registro de tu consentimiento: qué aceptaste, la versión del texto y la fecha.</li>
      </ul>
      <h3>Datos técnicos</h3>
      <ul>
        <li>Cookies esenciales de sesión (ver la sección 9).</li>
        <li>Registros técnicos de los servidores (por ejemplo dirección IP y fecha de acceso) que generan nuestros proveedores de alojamiento por seguridad.</li>
      </ul>

      <h2>3. Para qué los usamos y con qué base</h2>
      <table>
        <thead>
          <tr><th>Finalidad</th><th>Base</th></tr>
        </thead>
        <tbody>
          <tr><td>Crear y gestionar tu cuenta</td><td>Tu consentimiento y la ejecución del servicio que pediste</td></tr>
          <tr><td>Registrar reservas y avisarte por correo (confirmación, cancelación, reseña)</td><td>Tu consentimiento al reservar y la ejecución de la reserva</td></tr>
          <tr><td>Procesar compras y despachos de la tienda</td><td>La ejecución del contrato de compra</td></tr>
          <tr><td>Cobrar la suscripción de la barbería</td><td>La ejecución del contrato de servicio</td></tr>
          <tr><td>Mostrar estadísticas del negocio a la barbería</td><td>La ejecución del servicio contratado por la barbería</td></tr>
          <tr><td>Seguridad, prevención de fraude y cumplimiento de obligaciones legales y tributarias</td><td>Obligación legal e interés legítimo [COMPLETAR: revisar]</td></tr>
        </tbody>
      </table>
      <p>No vendemos tus datos ni los usamos para publicidad. No tomamos decisiones automatizadas que te afecten de forma significativa.</p>

      <h2>4. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Los datos de la cuenta, mientras la cuenta exista.</li>
        <li>Las reservas, pedidos y pagos se conservan [COMPLETAR: plazo] porque sostienen obligaciones tributarias y las estadísticas de la barbería.</li>
        <li>
          Si pides eliminar tus datos, borramos o reemplazamos tus datos de identificación (nombre, correo, teléfono,
          foto, direcciones, comentarios). Las transacciones quedan anonimizadas, sin forma de asociarlas a ti.
        </li>
        <li>El registro de consentimiento se conserva como prueba de lo que aceptaste. Retirar el consentimiento agrega un registro nuevo; no borra el anterior.</li>
      </ul>

      <h2>5. Con quién los compartimos</h2>
      <p>Solo con la barbería en la que reservas o compras, y con estos proveedores que procesan datos por nuestra cuenta:</p>
      <table>
        <thead>
          <tr><th>Proveedor</th><th>Para qué</th></tr>
        </thead>
        <tbody>
          <tr><td>Supabase</td><td>Base de datos, autenticación y almacenamiento de imágenes [COMPLETAR: región de los servidores]</td></tr>
          <tr><td>Vercel</td><td>Alojamiento del sitio</td></tr>
          <tr><td>Resend</td><td>Envío de correos</td></tr>
          <tr><td>Mercado Pago</td><td>Pagos con tarjeta de la tienda y de la suscripción</td></tr>
          <tr><td>Google</td><td>Mapa embebido con la ubicación de las sucursales</td></tr>
        </tbody>
      </table>
      <p>Algunos de estos proveedores procesan datos fuera de Chile. [COMPLETAR: revisar transferencia internacional de datos.]</p>

      <h2>6. Tus derechos</h2>
      <p>Puedes pedir en cualquier momento:</p>
      <ul>
        <li><strong>Acceso</strong>: saber qué datos tenemos sobre ti.</li>
        <li><strong>Rectificación</strong>: corregir datos inexactos. Los de tu perfil los puedes editar tú mismo.</li>
        <li><strong>Supresión</strong>: que eliminemos tus datos (ver <Link href="/eliminar-datos">Eliminar mis datos</Link>).</li>
        <li><strong>Oposición</strong> a un tratamiento y <strong>bloqueo</strong> temporal de tus datos.</li>
        <li><strong>Portabilidad</strong>: recibir tus datos en un formato que puedas llevar a otro servicio.</li>
        <li>Retirar tu consentimiento, sin que eso afecte lo hecho antes.</li>
      </ul>

      <h2>7. Cómo ejercerlos</h2>
      <p>
        Escribe a <a href={`mailto:${correo}`}>{correo}</a> desde el correo asociado a tu cuenta o a tus reservas.
        Si eres cliente de una barbería, también puedes pedírselo directamente a ella. Responderemos dentro de
        [COMPLETAR: plazo legal de respuesta]. Si no quedas conforme, puedes reclamar ante la Agencia de Protección
        de Datos Personales [COMPLETAR: confirmar autoridad y canal vigentes].
      </p>

      <h2>8. Menores de edad</h2>
      <p>El servicio no está dirigido a menores de edad. Las reservas para un menor las debe hacer un adulto responsable con sus propios datos.</p>

      <h2>9. Cookies y almacenamiento local</h2>
      <p>Usamos solo lo necesario para que el sitio funcione. No usamos cookies de analítica ni de publicidad.</p>
      <table>
        <thead>
          <tr><th>Nombre</th><th>Tipo</th><th>Para qué</th></tr>
        </thead>
        <tbody>
          <tr><td><code>sb-…-auth-token</code></td><td>Cookie esencial</td><td>Mantener tu sesión iniciada</td></tr>
          <tr><td><code>sb-recordar</code></td><td>Cookie esencial</td><td>Recordar si marcaste &quot;Mantener sesión iniciada&quot;</td></tr>
          <tr><td><code>cart-storage</code></td><td>Almacenamiento local</td><td>Guardar tu carrito de compra en este navegador</td></tr>
          <tr><td><code>theme</code></td><td>Almacenamiento local</td><td>Recordar el modo claro u oscuro</td></tr>
        </tbody>
      </table>
      <p>
        En la pantalla de pago, Mercado Pago carga su propio script, que puede usar cookies para prevenir fraude.
        El mapa de las sucursales lo muestra Google, que puede usar sus propias cookies. [COMPLETAR: revisar si el
        mapa requiere consentimiento previo.]
      </p>

      <h2>10. Seguridad</h2>
      <p>
        El sitio funciona solo con HTTPS. Cada barbería ve únicamente sus propios datos (reglas de acceso en la base
        de datos). No pedimos el RUT ni datos sensibles. Los datos de la tarjeta los recibe solo Mercado Pago.
      </p>

      <h2>11. Cambios</h2>
      <p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha y te pediremos aceptarla de nuevo cuando corresponda.</p>
    </>
  );
}
