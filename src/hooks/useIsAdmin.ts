import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Проверка "я админ" по таблице admins (читаем только свою строку). null = ещё грузится. */
export function useIsAdmin(userId?: string | null): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      return
    }
    let cancelled = false
    setIsAdmin(null)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle()
        if (!cancelled) setIsAdmin(!!data)
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId])
  return isAdmin
}
