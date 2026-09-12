import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_IN' && session?.user) {
        logLogin(session.user.id, 'session')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [session])

  async function logLogin(userId, method) {
    await supabase.from('login_history').insert({ user_id: userId, method })
  }

  async function signInWithPassword(email, password) {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (!result.error && result.data?.user) logLogin(result.data.user.id, 'email')
    return result
  }

  async function signUp(email, password) {
    const result = await supabase.auth.signUp({ email, password })
    if (!result.error && result.data?.user) logLogin(result.data.user.id, 'email (new account)')
    return result
  }

  async function signInAsGuest() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (!error && data?.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, account_type: 'guest' })
      logLogin(data.user.id, 'guest')
    }
    return { data, error }
  }

  async function signInWithGoogle() {
    const redirectTo = window.location.href.split('#')[0] + '#/home'
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  async function saveProfileDetails(updates) {
    if (!session?.user) return { error: new Error('Not signed in') }
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, ...updates })
      .select()
      .maybeSingle()
    if (!error) setProfile(data)
    return { data, error }
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithPassword,
    signUp,
    signInWithGoogle,
    signInAsGuest,
    signOut,
    saveProfileDetails,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
            }
