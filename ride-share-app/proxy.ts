import { phoneSchema } from '@/lib/profiles/contact'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { isAllowedStudentEmail } from '@/lib/auth/email-domain'

/**
 * Refreshes the Supabase auth session on every request and writes the rotated
 * cookies back onto the response. Without this, a Server Component reading the
 * session gets a stale token once the access token expires.
 *
 * Kept self-contained: Next 16 may deploy proxy separately from the render
 * code, so it does not share modules with the rest of the app.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Not configured yet — let the request through rather than 500 every route.
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Do not replace with getSession(): getUser verifies the JWT with Supabase.
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const pathname = request.nextUrl.pathname
  const needsAuth =
    pathname === '/onboarding' ||
    pathname === '/rides' ||
    pathname.startsWith('/rides/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/')

  if (needsAuth && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return redirectWithCookies(loginUrl, response)
  }

  if (user && needsAuth) {
    if (!user.email || !isAllowedStudentEmail(user.email)) {
      await supabase.auth.signOut()
      return redirectWithCookies(
        new URL('/login?status=invalid-domain', request.url),
        response,
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, photo_url, university, phone')
      .eq('id', user.id)
      .maybeSingle()

    const profileComplete = Boolean(
      profile?.full_name.trim() && profile.photo_url.trim() && profile.university.trim() && phoneSchema.safeParse(profile.phone).success,
    )


    if (pathname !== '/onboarding' && !profileComplete) {
      return redirectWithCookies(new URL('/onboarding', request.url), response)
    }
  }

  return response
}

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirectResponse = NextResponse.redirect(url)
  for (const cookie of source.cookies.getAll()) {
    redirectResponse.cookies.set(cookie)
  }
  return redirectResponse
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — otherwise the auth
     * round-trip runs on every CSS and image request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
