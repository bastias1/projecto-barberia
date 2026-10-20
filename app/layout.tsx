import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PLATAFORMA } from "@/lib/plataforma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Contenido bajo la zona segura del iPhone (barra inferior del dashboard)
export const viewport: Viewport = {
  viewportFit: "cover",
};

// Cada barbería redefine título y descripción en app/[slug]/layout.tsx
export const metadata: Metadata = {
  title: `${PLATAFORMA.nombre} - ${PLATAFORMA.descripcion}`,
  description:
    "Agenda online, tienda y gestión para barberías. Tus clientes reservan desde su celular y tú administras equipo, horarios y ventas.",
  keywords: ["barbería", "software barbería", "agenda online", "reservas", "peluquería", "barbero"],
  authors: [{ name: PLATAFORMA.nombre }],
  openGraph: {
    title: PLATAFORMA.nombre,
    description: PLATAFORMA.descripcion,
    type: "website",
    locale: "es_CL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
