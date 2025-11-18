import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Barbería BENJVMIN - Reservas Online",
  description:
    "Sistema de reservas online para Barbería BENJVMIN. Agenda tu cita, elige tu barbero y servicio. Profesionalismo y estilo en Valdivia.",
  keywords: ["barbería", "peluquería", "cortes", "Valdivia", "reservas", "BENJVMIN", "barbero"],
  authors: [{ name: "Barbería BENJVMIN" }],
  openGraph: {
    title: "Barbería BENJVMIN - Reservas Online",
    description: "Agenda tu cita con los mejores barberos de Valdivia. Tu estilo, nuestra pasión.",
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
