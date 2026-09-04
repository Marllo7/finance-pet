import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Category } from '../types/transaction'
import { categories as fallbackCategories } from '../utils/categories'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useCategories(userId: string | null | undefined) {
  const [categories, setCategories] = useState<Category[]>(fallbackCategories)
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // map DB row to Category (is_default хранится для UI-логики)
  function mapRow(row: any): Category {
    const labelRaw = row.label ?? ''
    return {
      id: row.id,
      label: typeof labelRaw === 'string' ? labelRaw.trim() : String(labelRaw),
      icon: row.icon,
      type: row.type,
      isDefault: row.is_default ?? false,
    }
  }

  async function fetchCategories() {
    const myReq = ++reqId.current
    if (!userId) {
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('categories')
      .select('*')
    if (userId && UUID_RE.test(userId)) {
      query = query.or(`user_id.is.null,user_id.eq.${userId}`) as typeof query
    } else {
      query = query.is('user_id', null) as typeof query
    }
    const { data, error } = await query
      .order('is_default', { ascending: false })
      .order('label')

    if (myReq !== reqId.current) return
    if (error) {
      console.error('categories fetch error', error)
      setCategories(fallbackCategories)
    } else if (data) {
      const mapped = (data as any[]).map(mapRow)
      if (mapped.length > 0) {
        // Deduplicate by label (case-insensitive) — happens if schema.sql was run twice (NULLs not unique)
        const seen = new Map<string, Category>()
        // insert defaults first so user custom can override same label
        const defaultsFirst = [...mapped].sort((a,b)=>{
          const ar = (data as any[]).find(r=>r.id===a.id)
          const br = (data as any[]).find(r=>r.id===b.id)
          // defaults first
          if(ar.is_default && !br.is_default) return -1
          if(!ar.is_default && br.is_default) return 1
          return 0
        })
        for(const c of defaultsFirst){
          const key = c.label.trim().toLowerCase()
          if(!seen.has(key)) seen.set(key, c)
          else {
            // if current is user custom and existing is default, replace
            const existing = seen.get(key)!
            const curRow = (data as any[]).find(r=>r.id===c.id)
            const exRow = (data as any[]).find(r=>r.id===existing.id)
            if(!curRow.is_default && exRow.is_default) seen.set(key, c)
          }
        }
        setCategories(Array.from(seen.values()).sort((a,b)=> a.label.localeCompare(b.label)))
      }
      else setCategories(fallbackCategories)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!userId) {
        setCategories([])
        setLoading(false)
        return
      }
      setLoading(true)
      let query = supabase
        .from('categories')
        .select('*')
      if (userId && UUID_RE.test(userId)) {
        query = query.or(`user_id.is.null,user_id.eq.${userId}`) as typeof query
      } else {
        query = query.is('user_id', null) as typeof query
      }
      const { data, error } = await query
        .order('is_default', { ascending: false })
        .order('label')

      if (cancelled) return
      if (error) {
        console.error('categories fetch error', error)
        setCategories(fallbackCategories)
      } else if (data) {
        const mapped = (data as any[]).map(mapRow)
        if (mapped.length > 0) {
          // Deduplicate by label (case-insensitive) — happens if schema.sql was run twice (NULLs not unique)
          const seen = new Map<string, Category>()
          // insert defaults first so user custom can override same label
          const defaultsFirst = [...mapped].sort((a,b)=>{
            const ar = (data as any[]).find(r=>r.id===a.id)
            const br = (data as any[]).find(r=>r.id===b.id)
            // defaults first
            if(ar.is_default && !br.is_default) return -1
            if(!ar.is_default && br.is_default) return 1
            return 0
          })
          for(const c of defaultsFirst){
            const key = c.label.trim().toLowerCase()
            if(!seen.has(key)) seen.set(key, c)
            else {
              // if current is user custom and existing is default, replace
              const existing = seen.get(key)!
              const curRow = (data as any[]).find(r=>r.id===c.id)
              const exRow = (data as any[]).find(r=>r.id===existing.id)
              if(!curRow.is_default && exRow.is_default) seen.set(key, c)
            }
          }
          setCategories(Array.from(seen.values()).sort((a,b)=> a.label.localeCompare(b.label)))
        }
        else setCategories(fallbackCategories)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  async function createCategory(label: string, icon: string, type: Category['type']) {
    if (!userId) {
      const newCat: Category = { id: Date.now().toString(), label, icon, type }
      setCategories((prev) => [...prev, newCat])
      return { data: newCat, error: null as string | null }
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, label: label.trim(), icon: icon.trim() || '📦', type, is_default: false })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    const cat = mapRow(data)
    setCategories((prev) => [...prev, cat])
    return { data: cat, error: null }
  }

  async function deleteCategory(id: string) {
    if (!userId) {
      const cat = categories.find((c) => c.id === id)
      if (cat?.isDefault) return { error: null as string | null }
      setCategories((prev) => prev.filter((c) => c.id !== id))
      return { error: null as string | null }
    }
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId)
    if (!error) setCategories((prev) => prev.filter((c) => c.id !== id))
    return { error: error?.message ?? null }
  }

  return { categories, loading, createCategory, deleteCategory, refresh: fetchCategories }
}
