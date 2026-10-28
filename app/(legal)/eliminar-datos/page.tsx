import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATAFORMA } from "@/lib/plataforma";

// BORRADOR: requiere revisión legal antes de producción (Ley 21.719, derecho de supresión).
// La solicitud se aprueba y ejecuta en /admin/usuarios → "Eliminar datos de una persona".

export const metadata: Metadata = { title: `Eliminar mis datos - ${PLATAFORMA.nombre}` };

export default function EliminarDatosPage() {
  const correo = PLATAFORMA.emailContacto;
  const mailto = `mailto:${correo}?${new URLSearchParams({
    subject: "Solicitud de eliminación de datos",
    body: [
      "Hola, solicito eliminar mis datos personales.",
      "",
      "Nombre:",
      "Correo de mi cuenta o de mis reservas:",
      "Barbería(s) donde reservé o compré:",
      "Tengo cuenta: sí / no",
    ].join("\n"),
  }).toString().replace(/\+/g, "%20")}`;

  return (
    <>
      <h1>Eliminar mis datos</h1>
      <p>
        Puedes pedir que eliminemos tus datos personales, tengas cuenta o hayas reservado como invitado. También
        puedes pedírselo directamente a la barbería donde reservaste o compraste.
      </p>

      <h2>Cómo pedirlo</h2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Escríbenos a <a href={`mailto:${correo}`}>{correo}</a> <strong>desde el correo de tu cuenta o de tus reservas</strong>, con el asunto &quot;Solicitud de eliminación de datos&quot;.</li>
        <li>Indica tu nombre, ese correo y las barberías donde reservaste o compraste.</li>
        <li>Te responderemos a ese mismo correo para confirmar que eres tú antes de borrar nada.</li>
      </ol>
      <p>
        <Button asChild>
          <a href={mailto} className="no-underline! gap-2">
            <Mail className="h-4 w-4" aria-hidden="true" />
            Escribir la solicitud
          </a>
        </Button>
      </p>

      <h2>Plazo de respuesta</h2>
      <p>Respondemos y ejecutamos la solicitud dentro de [COMPLETAR: plazo legal, contado desde que confirmamos tu identidad].</p>

      <h2>Qué eliminamos</h2>
      <ul>
        <li>Tu nombre, apellido, correo, teléfono, foto de perfil y direcciones guardadas.</li>
        <li>Los comentarios de tus reseñas y las notas de tus reservas.</li>
        <li>El acceso a tu cuenta: ya no podrás iniciar sesión con ella.</li>
        <li>Tus reservas futuras quedan canceladas.</li>
      </ul>

      <h2>Qué conservamos</h2>
      <ul>
        <li>
          Las reservas, pedidos y pagos pasados, <strong>anonimizados</strong>: sin nombre ni datos de contacto. Los
          necesitamos por obligaciones legales y tributarias, y para que las estadísticas de la barbería no cambien.
        </li>
        <li>El registro de que aceptaste la política de privacidad (fecha y versión), como prueba de tu consentimiento.</li>
      </ul>

      <p>Más detalles en la <Link href="/privacidad">política de privacidad</Link>.</p>
    </>
  );
}
