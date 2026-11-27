import Link from "next/link";
import { Button } from "@/components/ui/button";

/** La contraseña se cambia en un solo lugar, que pide la actual. */
export function PasswordForm() {
  return (
    <Button asChild variant="outline">
      <Link href="/cuenta/clave">Cambiar contraseña</Link>
    </Button>
  );
}
