import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = ['/dashboard', '/profile', '/checkout', '/market/digital']
const authRoutes = ['/login', '/register']

// Am adăugat "default" pentru ca Next.js / Turbopack să recunoască funcția corect
export default function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get('next-auth.session-token')?.value 
  const pathname = request.nextUrl.pathname || '' 

  // 1. Redirecționare dacă userul NU este logat și vrea pe o rută privată
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
  if (isProtected && !sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname) 
    return NextResponse.redirect(loginUrl)
  }

  // 2. Redirecționare dacă userul ESTE logat și vrea pe login/register
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/checkout/:path*',
    '/e-market/:path*',
    '/login',
    '/register'
  ],
}
