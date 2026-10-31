'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthProfile {
  full_name: string
  username: string
  role: string
  is_active?: boolean
}

interface AuthContextType {
  user: User | null
  profile: AuthProfile | null
  loading: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
})

const USER_CACHE_KEY = 'app_auth_user'
const PROFILE_CACHE_KEY = 'app_auth_profile'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always initialize with null so server HTML and initial client render match 100%
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const loadUser = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        try {
          sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
        } catch {}

        const { data } = await supabase
          .from('profiles')
          .select('full_name, username, role, is_active')
          .eq('id', user.id)
          .maybeSingle()

        if (data) {
          if (data.role !== 'admin' && data.is_active === false) {
            await supabase.auth.signOut()
            sessionStorage.removeItem(USER_CACHE_KEY)
            sessionStorage.removeItem(PROFILE_CACHE_KEY)
            setUser(null)
            setProfile(null)
            window.location.href = '/login?error=account_disabled'
            return
          }
          setProfile(data)
          try {
            sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data))
          } catch {}
        }
      } else {
        sessionStorage.removeItem(USER_CACHE_KEY)
        sessionStorage.removeItem(PROFILE_CACHE_KEY)
        setProfile(null)
      }
    } catch {
      // Keep existing cached state on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Immediately populate from session cache upon client mount (0ms, no hydration mismatch)
    try {
      const cachedUser = sessionStorage.getItem(USER_CACHE_KEY)
      const cachedProfile = sessionStorage.getItem(PROFILE_CACHE_KEY)
      if (cachedUser) setUser(JSON.parse(cachedUser))
      if (cachedProfile) setProfile(JSON.parse(cachedProfile))
      if (cachedUser) setLoading(false)
    } catch {}

    // Revalidate in background
    loadUser()

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        try {
          sessionStorage.removeItem(USER_CACHE_KEY)
          sessionStorage.removeItem(PROFILE_CACHE_KEY)
        } catch {}
        setUser(null)
        setProfile(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN') {
        loadUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUser])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
