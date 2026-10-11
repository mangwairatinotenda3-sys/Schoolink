import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { setGuestMode } from '../lib/guestShield.js'
import { isNativeApp, signInWithGoogleNative } from '../lib/nativeAuth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [teamRole, setTeamRole] = useState(null)
  const [teamLoading, setTeamLoading] = useState(true)
  const userId = session?.user?.id ?? null
  // Guests are anonymous accounts ("Continue as Guest"). They can browse but not change anything.
  const isGuest = !!session?.user?.is_anonymous
  setGuestMode(isGuest)

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

  // Is this account part of the Schoolink team? (owner / verifier / moderator / support)
  // The answer comes from the database, tied to the account's email, so it can't be faked here.
  useEffect(() => {
    if (!userId) {
      setTeamRole(null)
      setTeamLoading(false)
      return
    }
    let cancelled = false
    setTeamLoading(true)
    supabase.rpc('team_role').then(({ data, error }) => {
      if (cancelled) return
      setTeamRole(error ? null : data || null)
      setTeamLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  async function refreshTeamRole() {
    const { data, error } = await supabase.rpc('team_role')
    setTeamRole(error ? null : data || null)
  }

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
    // In the Android / iPhone app Google opens in the phone's browser instead.
    if (isNativeApp()) return signInWithGoogleNative()
    // Send Google back to the bare page address (no "#/route", no "?query").
    // The router uses the part after "#", and Supabase puts the sign-in tokens
    // there too, so a route in the address would collide with them.
    // main.jsx lets Supabase read the tokens before the app starts, and
    // Welcome's own effect then sends the person on to /home or onboarding.
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // Always let the person pick which Google account to use.
        queryParams: { prompt: 'select_account' },
      },
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
    isGuest,
    teamRole,
    teamLoading,
    refreshTeamRole,
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
