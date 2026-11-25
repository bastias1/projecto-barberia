import { TiendaShell } from "@/components/shop/tienda-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TiendaShell>{children}</TiendaShell>;
}
