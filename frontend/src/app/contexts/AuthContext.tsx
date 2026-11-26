"use client"

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { onAuthStateChanged } from "firebase/auth"
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase"
import { fetchCurrentUser, signOutUser } from "@/lib/auth-api"

type AuthUser = {
  id: number
  name: string
  firstName: string | null
  lastName: string | null
  email: string
  role: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  completeSignIn: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  completeSignIn: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const authRequest = useRef(0)
  const [loading, setLoading] = useState(
    Boolean(isFirebaseConfigured && firebaseAuth),
  )

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return
    }

    let unsubscribe: (() => void) | null = null
    let mounted = true

    // Safety timeout — if onAuthStateChanged doesn't fire within 5s,
    // stop loading so the user doesn't see an infinite spinner
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!mounted) return
      const request = ++authRequest.current

      if (firebaseUser) {
        try {
          const userData = await fetchCurrentUser()
          if (!mounted || request !== authRequest.current) return

          if (userData) {
            setUser(userData)
          } else {
            // Backend session expired or backend temporarily down.
            // Keep Firebase auth intact so the user can retry later.
            setUser(null)
          }
        } catch {
          if (!mounted || request !== authRequest.current) return
          setUser(null)
        }
      } else {
        // Firebase says: not signed in
        setUser(null)
      }
      setLoading(false)
    })

    // ✅ This return IS from useEffect — React calls it on unmount
    return () => {
      mounted = false
      clearTimeout(timeout)
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // Firebase can emit before the backend has set its session cookie.
  // Prefer the user returned by the completed backend sign-in request.
  const completeSignIn = useCallback((userData: AuthUser) => {
    authRequest.current++
    setUser(userData)
    setLoading(false)
  }, [])

  const signOut = async () => {
    await signOutUser()
    authRequest.current++
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, completeSignIn }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
