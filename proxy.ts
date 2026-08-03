import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutele private pe care vrei să le protejezi
const protectedRoutes = ['/dashboard', '/profile', '/checkout', '/market']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Permite accesul liber și instant pentru fișiere interne, imagini și rutele de autentificare API (Facebook/Spotify)
  if (
    pathname.startsWith('/api/') || 
    pathname.startsWith('/_next/') || 
    pathname.startsWith('/login') || 
    pathname.startsWith('/register') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  
  // 2. Verifică prezența token-ului de sesiune (atât pe localhost, cât și securizat pe Vercel HTTPS)
  const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                       request.cookies.get('__Secure-next-auth.session-token')?.value

  // 3. Verifică dacă utilizatorul încearcă să acceseze o rută protejată
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))

  // Dacă ruta este privată și utilizatorul NU are cookie-ul de sesiune, îl trimitem la login
  if (isProtected && !sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname) // Salvează pagina pentru a reveni după login
    return NextResponse.redirect(loginUrl)
  }

  // Permite accesul dacă totul este în regulă
  return NextResponse.next()
}

// Configurează rutele pe care rulează acest proxy ca să nu încetinească restul site-ului
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/checkout/:path*',
    '/e-market/:path*',
  ],
}
