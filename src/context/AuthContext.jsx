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
    if (!result.error && result.data?.user) {
      // Supabase returns a "successful" response here (no error) even when the
      // email is already registered — it does this on purpose so a bad actor
      // can't use signup to find out which emails exist. The one reliable
      // signal that this is actually an existing account is an empty
      // identities array on the returned user.
      const accountExists =
        Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0
      if (accountExists) {
        return { data: result.data, error: null, accountExists: true }
      }
      if (result.data.session) logLogin(result.data.user.id, 'email (new account)')
    }
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
    // Strip any existing hash before handing this off as the redirect target.
    // If we appended a route like '#/home' here, Supabase would glue its own
    // '#access_token=...' onto the end of that same hash fragment when Google
    // sends the user back — and since this app uses HashRouter (required for
    // GitHub Pages, which can't rewrite arbitrary paths), that collision
    // between "the route" and "the auth tokens" living in the same URL hash
    // is what was sending you back to the Welcome screen: the token parsing
    // got confused and no session ever got set. Redirecting to the bare
    // origin instead avoids the collision — Supabase cleanly reads the
    // tokens, and Welcome's own effect then sends you on to /home or
    // onboarding once the session appears.
    const redirectTo = window.location.href.split('#')[0]
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
