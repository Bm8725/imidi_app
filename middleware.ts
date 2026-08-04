import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // 1. Permitem accesul liber la rutele de callback sau fișiere statice ca să nu blocăm autentificarea
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
    return res
  }

  // 2. Inițializăm clientul Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 3. Verificăm Sesiunea Reală folosind getUser() (metoda sigură pe server)
  // Supabase va citi automat cookie-urile transmise în header-ul cererii
  const { data: { user } } = await supabase.auth.getUser()

  // 4. Regula de protecție pentru Dashboard
  if (pathname.startsWith('/dashboard') && !user) {
    // Dacă nu este logat sau token-ul a expirat, îl aruncăm direct la login
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // 5. Opțional: Dacă userul este deja logat și încearcă să acceseze manual pagina de /login,
  // îl trimitem direct în dashboard ca să nu vadă formularul de login degeaba
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard/cloud-db', req.url))
  }

  return res
}

export const config = {
  // Monitorizăm dashboard-ul și pagina de login
  matcher: ['/dashboard/:path*', '/login'],
}
