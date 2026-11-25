import { AparienciaProvider } from "@/components/apariencia-provider";

/** Páginas de cliente de la barbería: llevan su apariencia. El dashboard queda fuera de este grupo. */
export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return <AparienciaProvider>{children}</AparienciaProvider>;
}
