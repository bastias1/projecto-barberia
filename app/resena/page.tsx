import Link from "next/link";
import { verifyLink } from "@/lib/signed-links";
import { cargarResenaPedido, cargarResenaReserva } from "@/lib/review-link";
import { formatFecha } from "@/lib/datetime";
import { ReviewLinkForm } from "@/components/reviews/review-link-form";

export const dynamic = "force-dynamic";

function Shell({ titulo, slug, children }: { titulo: string; slug?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-8 border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold mb-3 text-center text-zinc-900 dark:text-zinc-100">{titulo}</h1>
        {children}
        <Link
          href={slug ? `/${slug}` : "/"}
          className="block text-center text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mt-6"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return <p className="text-center text-zinc-600 dark:text-zinc-400">{texto}</p>;
}

/**
 * Página a la que llega el cliente desde el correo para dejar su reseña.
 * El token firmado reemplaza al inicio de sesión.
 */
export default async function ResenaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; id?: string; token?: string }>;
}) {
  const { tipo, id, token } = await searchParams;
  const idNum = Number(id);
  const tipoValido = tipo === "reserva" || tipo === "pedido";

  if (!tipoValido || !Number.isInteger(idNum) || !token ||
      !verifyLink(tipo === "reserva" ? "resena-reserva" : "resena-pedido", idNum, token)) {
    return (
      <Shell titulo="Link no válido">
        <Aviso texto="Este link de reseña no es válido. Revisa que lo hayas copiado completo desde el correo." />
      </Shell>
    );
  }

  if (tipo === "reserva") {
    const reserva = await cargarResenaReserva(idNum);
    if (!reserva) {
      return <Shell titulo="Reserva no encontrada"><Aviso texto="No encontramos la cita asociada a este link." /></Shell>;
    }
    if (!reserva.completada) {
      return <Shell titulo="Aún no puedes opinar" slug={reserva.slugBarberia}><Aviso texto="Podrás dejar tu reseña cuando la cita se haya completado." /></Shell>;
    }
    if (reserva.yaResenada) {
      return <Shell titulo="¡Gracias!" slug={reserva.slugBarberia}><Aviso texto="Ya registramos tu reseña de esta cita." /></Shell>;
    }

    return (
      <Shell titulo="¿Cómo te fue?" slug={reserva.slugBarberia}>
        <p className="text-center text-zinc-600 dark:text-zinc-400 mb-6">
          {reserva.nombreCliente ? `${reserva.nombreCliente}, califica` : "Califica"} tu {reserva.servicio.toLowerCase()} con{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{reserva.barbero}</span> del{" "}
          {formatFecha(reserva.fecha, "d 'de' MMMM")}.
        </p>
        <ReviewLinkForm tipo="reserva" id={idNum} token={token} />
      </Shell>
    );
  }

  const pedido = await cargarResenaPedido(idNum);
  if (!pedido) {
    return <Shell titulo="Pedido no encontrado"><Aviso texto="No encontramos el pedido asociado a este link." /></Shell>;
  }
  if (!pedido.entregado) {
    return <Shell titulo="Aún no puedes opinar" slug={pedido.slugBarberia}><Aviso texto="Podrás calificar los productos cuando el pedido haya sido entregado." /></Shell>;
  }

  return (
    <Shell titulo="Califica tus productos" slug={pedido.slugBarberia}>
      <p className="text-center text-zinc-600 dark:text-zinc-400 mb-6">
        Pedido #{pedido.id}. Elige un producto para dejar tu opinión.
      </p>
      <ReviewLinkForm tipo="pedido" id={idNum} token={token} productos={pedido.productos} />
    </Shell>
  );
}
