import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../types/transaction'

function mapRow(row: any): Transaction {
  const n = Number(row.amount)
  const catRaw = row.category_id ?? row.category_label ?? 'other'
  return {
    id: row.id,
    type: row.type,
    amount: Number.isFinite(n) ? n : 0,
    category: typeof catRaw === 'string' ? (catRaw.trim() || 'other') : String(catRaw ?? 'other'),
    date: row.date,
    comment: row.comment ?? undefined,
    icon: undefined,
  }
}

export function useTransactions(userId: string | null | undefined, categoriesReady: boolean) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const reqId = useRef(0)

  async function fetchTransactions() {
    const myReq = ++reqId.current
    if (!userId) {
      setTransactions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(label, icon)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000)
    if (myReq !== reqId.current) return
    if (error) {
      console.error('transactions fetch error', error)
    } else if (data) {
      const mapped = (data as any[]).map((row) => {
        const base = mapRow(row)
        // если есть join с categories — берём иконку оттуда
        if (row.categories) base.icon = row.categories.icon
        return base
      })
      setTransactions(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!userId) {
        setTransactions([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(label, icon)')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000)
      if (cancelled) return
      if (error) {
        console.error('transactions fetch error', error)
      } else if (data) {
        const mapped = (data as any[]).map((row) => {
          const base = mapRow(row)
          // если есть join с categories — берём иконку оттуда
          if (row.categories) base.icon = row.categories.icon
          return base
        })
        setTransactions(mapped)
      }
      setLoading(false)
    }
    if (categoriesReady) load()
    return () => { cancelled = true }
  }, [userId, categoriesReady])

  async function addTransaction(t: Transaction, categoryId: string | null) {
    if (!userId) {
      setTransactions((prev) => [t, ...prev])
      return { error: null as string | null }
    }
    // category_id: если t.category — uuid из списка категорий, иначе fallback на label
    const payload: any = {
      user_id: userId,
      type: t.type,
      amount: t.amount,
      date: t.date,
      comment: t.comment ?? null,
    }
    if (categoryId) payload.category_id = categoryId
    else payload.category_label = t.category

    const { data, error } = await supabase.from('transactions').insert(payload).select('*, categories(label, icon)').single()
    if (error) return { error: error.message }
    const mapped = mapRow(data)
    if (data.categories) mapped.icon = data.categories.icon
    setTransactions((prev) => [mapped, ...prev])
    return { error: null }
  }

  async function deleteTransaction(id: string) {
    if (!userId) {
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      return { error: null as string | null }
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
    if (!error) setTransactions((prev) => prev.filter((t) => t.id !== id))
    return { error: error?.message ?? null }
  }

  async function updateTransaction(id: string, patch: Partial<Transaction>, categoryId: string | null) {
    if (!userId) {
      setTransactions((prev) => prev.map(t=> t.id===id ? { ...t, ...patch, category: patch.category ?? t.category } : t))
      return { error: null as string | null }
    }
    const payload: any = {}
    if (patch.type) payload.type = patch.type
    if (patch.amount !== undefined) payload.amount = patch.amount
    if (patch.date) payload.date = patch.date
    if (patch.comment !== undefined) payload.comment = patch.comment ?? null
    if (categoryId !== null) payload.category_id = categoryId
    else if (patch.category) {
      payload.category_id = null
      payload.category_label = patch.category
    }

    const { data, error } = await supabase.from('transactions').update(payload).eq('id', id).eq('user_id', userId).select('*, categories(label, icon)').single()
    if (error) return { error: error.message }
    const mapped = mapRow(data)
    if (data.categories) mapped.icon = data.categories.icon
    // preserve original id
    mapped.id = id
    setTransactions((prev) => prev.map(t=> t.id===id ? mapped : t))
    return { error: null }
  }

  return { transactions, loading, addTransaction, deleteTransaction, updateTransaction, refresh: fetchTransactions, setTransactions }
}
