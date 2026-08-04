import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    // Schimbă codul de la Google într-o sesiune activă Supabase
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Dacă e cu succes, trimite userul pe dashboard
      return NextResponse.redirect(`${origin}/dashboard/cloud-db`)
    }
  }

  // Dacă e eroare, trimite userul înapoi la login cu un mesaj
  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
