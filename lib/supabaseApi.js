import { createServerClient } from '@supabase/ssr'

// Create Supabase client for API routes that can read cookies from request
export const createApiClient = (request) => {
  // Get cookies from request headers
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) {
      acc[name] = value
    }
    return acc
  }, {})

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(cookies).map(([name, value]) => ({
            name,
            value
          }))
        },
        setAll(cookiesToSet) {
          // In API routes, we can't set cookies directly
          // This is handled by the client-side
        },
      },
    }
  )
}

