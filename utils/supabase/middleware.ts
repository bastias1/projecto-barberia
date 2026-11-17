import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { opcionesCookie, RECORDAR_COOKIE, sesionPersistente } from '@/lib/sesion'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          // Respeta "Mantener sesión iniciada": el refresco del token no vuelve a fijar 400 días
          const persistente = sesionPersistente(request.cookies.get(RECORDAR_COOKIE)?.value)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, opcionesCookie(options, persistente))
          )
        },
      },
    }
  )

  // refreshing the auth token
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión en un dashboard o en /admin: al login conservando la página pedida
  // (las páginas solo conocen el slug, no la ruta completa)
  const { pathname, search } = request.nextUrl
  const dashboard = pathname.match(/^\/([^/]+)\/dashboard(\/|$)/)
  if (!user && (dashboard || /^\/admin(\/|$)/.test(pathname))) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = new URLSearchParams({ ...(dashboard ? { barberia: dashboard[1] } : {}), next: pathname + search }).toString()
    return NextResponse.redirect(login)
  }

  return supabaseResponse
}