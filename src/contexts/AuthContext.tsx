import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/transaction'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** Профиль загружен (или юзера нет) — можно решать про онбординг */
  profileLoaded: boolean
  userName: string | null
  petName: string | null
  setUserName: (name: string) => Promise<{ error: string | null }>
  setPetName: (name: string | null) => Promise<{ error: string | null }>
  markNameAsked: () => Promise<void>
  markTourDone: () => Promise<void>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [petName, setPetNameLocal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const profileReqId = useRef(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        fetchProfile(data.session.user.id)
      } else {
        setProfileLoaded(true)
      }
      setLoading(false)
    }).catch((e) => {
      console.error('getSession error', e)
      setProfileLoaded(true)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      if (sess?.user) {
        setProfileLoaded(false)
        fetchProfile(sess.user.id)
      } else {
        profileReqId.current++
        setProfile(null)
        setUserName(null)
        setPetNameLocal(null)
        setProfileLoaded(true)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const reqId = ++profileReqId.current
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (reqId !== profileReqId.current) return
    if (error || !data) {
      setProfile(null)
      setUserName(null)
      setPetNameLocal(null)
      setProfileLoaded(true)
      return
    }
    setProfile(data as Profile)
    setUserName((data as Profile).name ?? null)
    setPetNameLocal((data as Profile).pet_name ?? null)
    setProfileLoaded(true)
  }

  async function setUserNameFn(name: string): Promise<{ error: string | null }> {
    const trimmed = name.trim()
    const prev = userName
    setUserName(trimmed)

    if (!user) return { error: null }
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, name: trimmed, email: user.email ?? null }, { onConflict: 'id' })
      if (error) {
        setUserName(prev)
        return { error: error.message }
      }
      return { error: null }
    } catch (e) {
      setUserName(prev)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  async function setPetNameFn(name: string | null): Promise<{ error: string | null }> {
    const prev = petName
    setPetNameLocal(name)

    if (!user) return { error: null }
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, pet_name: name }, { onConflict: 'id' })
      if (error) {
        setPetNameLocal(prev)
        return { error: error.message }
      }
      return { error: null }
    } catch (e) {
      setPetNameLocal(prev)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }
  async function signOut() {
    profileReqId.current++
    setUser(null)
    setSession(null)
    setProfile(null)
    setUserName(null)
    setPetNameLocal(null)
    setProfileLoaded(true)
    await supabase.auth.signOut()
  }

  /** Флаги онбординга в БД (кроссе-девайс) — best-effort, localStorage дублирует */
  async function markFlag(column: 'name_asked' | 'tour_done'): Promise<void> {
    setProfile((prev) => (prev ? { ...prev, [column]: true } : prev))
    if (!user) return
    try {
      await supabase.from('profiles').upsert({ id: user.id, [column]: true }, { onConflict: 'id' })
    } catch { /* offline — останется localStorage */ }
  }

  async function markNameAsked(): Promise<void> {
    await markFlag('name_asked')
  }

  async function markTourDone(): Promise<void> {
    await markFlag('tour_done')
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoaded, userName, petName, setUserName: setUserNameFn, setPetName: setPetNameFn, markNameAsked, markTourDone, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
