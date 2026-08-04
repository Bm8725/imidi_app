import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  // 1. Căutăm cookie-ul oficial generat automat de Supabase în browser
  // Acesta începe mereu cu "sb-" și conține ID-ul proiectului tău
  const allCookies = req.cookies.getAll()
  const supabaseCookie = allCookies.find(cookie => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'))
  const hasToken = !!supabaseCookie?.value

  // 2. Protecție strictă pentru Dashboard
  if (pathname.startsWith('/dashboard') && !hasToken) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 3. Dacă este deja logat și accesează manual login, îl trimitem în dashboard
  if (pathname === '/login' && hasToken) {
    return NextResponse.redirect(new URL('/dashboard/cloud-db', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
