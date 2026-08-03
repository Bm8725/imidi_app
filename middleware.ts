import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Definiți rutele care necesită autentificare
const protectedRoutes = ['/dashboard',, '/checkout', '/e-market']
// Definiți rutele accesibile doar pentru vizitatori (ex: login)
const authRoutes = ['/login', '/register']

export function middleware(request: NextRequest) {
  // Înlocuiește cu numele exact al cookie-ului tău de sesiune (ex: next-auth.session-token)
  const sessionToken = request.cookies.get('next-auth.session-token')?.value 
  const { pathname } = request.nextUrl

  // 1. Redirecționare dacă userul NU este logat și vrea pe o rută privată
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
  if (isProtected && !sessionToken) {
    const loginUrl = new URL('/login', request.url)
    // Salvează URL-ul dorit ca utilizatorul să revină acolo după login
    loginUrl.searchParams.set('callbackUrl', pathname) 
    return NextResponse.redirect(loginUrl)
  }

  // 2. Redirecționare dacă userul ESTE logat și vrea pe pagina de login
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// Optimizează performanța: rulează middleware-ul doar pe rutele necesare
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/checkout/:path*',
    '/e-market/:path*',
    '/login',
    '/register'
  ],
}
