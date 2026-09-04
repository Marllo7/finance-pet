import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase env not set: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  console.warn('   Приложение запустится, но все операции будут недоступны.')
  console.warn('   Для Cloudflare Pages задай переменные в Settings → Environment variables')
}

// Graceful fallback: если env vars не заданы, создаём заглушку чтобы не было белого экрана
function createChainableProxy(): unknown {
  const result = { data: null, error: { message: 'Supabase not configured' } }
  const proxy: unknown = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(result)
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => proxy
      }
      return (..._args: unknown[]) => proxy
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

function createDummyClient(): SupabaseClient<any, 'public', 'public'> {
  const dummy = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({}),
      getUser: async () => ({ data: { user: null }, error: { message: 'Supabase not configured' } }),
    },
    from: () => createChainableProxy() as unknown as ReturnType<SupabaseClient<any, 'public', 'public'>['from']>,
    url: '',
  } as unknown as SupabaseClient<any, 'public', 'public'>
  return dummy
}

export const supabase: SupabaseClient<any, 'public', 'public'> = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : createDummyClient()
