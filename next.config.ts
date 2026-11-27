import type { NextConfig } from "next";

// Imágenes de Supabase Storage: el proyecto actual (productos, avatares) y el
// anterior, que aún sirve los logos.
const supabaseHosts = [
  process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null,
  'iuhmjpqwkueueakybgaz.supabase.co',
].filter((host, i, all): host is string => !!host && all.indexOf(host) === i);

// Antes de ser multi-barbería el sitio era solo de BENJVMIN: los links viejos
// (Instagram, correos, Mercado Pago) siguen llevando a su página.
const RUTAS_ANTIGUAS = ['agendar', 'tienda', 'cart', 'carrito', 'checkout', 'dashboard', 'booking-confirmed', 'booking-cancelled'];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // El perfil por barbería se unificó en /cuenta
      { source: '/profile', destination: '/cuenta/perfil', permanent: false },
      // sin "api": /api/profile es la ruta de datos del perfil
      { source: '/:slug((?!api/)[^/]+)/profile', destination: '/cuenta/perfil', permanent: false },
      ...RUTAS_ANTIGUAS.flatMap((ruta) => [
        { source: `/${ruta}`, destination: `/benjvmin/${ruta}`, permanent: false },
        { source: `/${ruta}/:path*`, destination: `/benjvmin/${ruta}/:path*`, permanent: false },
      ]),
    ];
  },
  images: {
    remotePatterns: supabaseHosts.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
      port: '',
      pathname: '/storage/v1/object/public/**',
    })),
  },
};

export default nextConfig;
