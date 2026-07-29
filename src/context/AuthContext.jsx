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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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

  async function signInWithPassword(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password) {
    return supabase.auth.signUp({ email, password })
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
