import { CalendarClock, Home, KeyRound, MapPin, ShoppingBag, Store, User } from "lucide-react";

/** Secciones de la cuenta (el Resumen muestra las demás como atajos). */
export const SECCIONES = [
  { href: "/cuenta", label: "Resumen", texto: "", icon: Home },
  { href: "/cuenta/perfil", label: "Perfil", texto: "Nombre, teléfono, foto y correo", icon: User },
  { href: "/cuenta/reservas", label: "Reservas", texto: "Próximas y anteriores", icon: CalendarClock },
  { href: "/cuenta/compras", label: "Compras", texto: "Tus pedidos en las tiendas", icon: ShoppingBag },
  { href: "/cuenta/direcciones", label: "Direcciones", texto: "Para tus despachos", icon: MapPin },
  { href: "/cuenta/barberias", label: "Barberías", texto: "Donde trabajas o eres cliente", icon: Store },
  { href: "/cuenta/clave", label: "Seguridad", texto: "Contraseña y sesión", icon: KeyRound },
];

/** Título y descripción de una sección de la cuenta. */
export function EncabezadoSeccion({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="display text-3xl break-words">{titulo}</h1>
      {descripcion && <p className="text-muted-foreground">{descripcion}</p>}
    </div>
  );
}
