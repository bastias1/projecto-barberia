import { createBrowserClient } from "@supabase/ssr";
import { opcionesCookie, RECORDAR_COOKIE, sesionPersistente } from "@/lib/sesion";

type CookieOptions = {
  path?: string;
  maxAge?: number;
  expires?: Date;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  domain?: string;
};

function leerCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split("; ").map((par) => {
    const i = par.indexOf("=");
    return { name: decodeURIComponent(par.slice(0, i)), value: decodeURIComponent(par.slice(i + 1)) };
  });
}

function escribirCookie(name: string, value: string, options: CookieOptions = {}) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${options.path ?? "/"}`;
  if (options.maxAge !== undefined) cookie += `; max-age=${options.maxAge}`;
  if (options.expires) cookie += `; expires=${options.expires.toUTCString()}`;
  if (options.domain) cookie += `; domain=${options.domain}`;
  if (options.sameSite) cookie += `; samesite=${options.sameSite === true ? "strict" : options.sameSite}`;
  if (options.secure) cookie += "; secure";
  document.cookie = cookie;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return leerCookies();
        },
        // Respeta "Mantener sesión iniciada" (lib/sesion.ts)
        setAll(cookiesToSet) {
          const persistente = sesionPersistente(leerCookies().find((c) => c.name === RECORDAR_COOKIE)?.value);
          cookiesToSet.forEach(({ name, value, options }) =>
            escribirCookie(name, value, opcionesCookie(options as CookieOptions, persistente))
          );
        },
      },
    }
  );
}
