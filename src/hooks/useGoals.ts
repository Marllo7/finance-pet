import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Goal } from '../types/transaction'

function mapRow(row: any): Goal {
  const target = Number(row.target_amount)
  const saved = Number(row.saved_amount ?? 0)
  const nameRaw = row.name ?? ''
  return {
    id: row.id,
    name: typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw),
    icon: row.icon ?? '🎯',
    targetAmount: Number.isFinite(target) ? target : 0,
    savedAmount: Number.isFinite(saved) ? saved : 0,
    deadline: row.deadline ?? undefined,
    color: row.color ?? '#7c5cff',
    createdAt: row.created_at,
  }
}

export function useGoals(userId: string | null | undefined) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const reqId = useRef(0)

  async function fetchGoals() {
    const myReq = ++reqId.current
    if (!userId) {
      setGoals([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (myReq !== reqId.current) return
    if (error) {
      console.error('goals fetch error', error)
    } else if (data) {
      setGoals((data as any[]).map(mapRow))
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!userId) {
        setGoals([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('goals fetch error', error)
      } else if (data) {
        setGoals((data as any[]).map(mapRow))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  async function addGoal(g: Omit<Goal, 'id' | 'createdAt'>) {
    if (!userId) {
      const local: Goal = {
        ...g,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setGoals((prev) => [local, ...prev])
      return { error: null as string | null }
    }
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        name: g.name,
        icon: g.icon,
        target_amount: g.targetAmount,
        saved_amount: g.savedAmount,
        deadline: g.deadline ?? null,
        color: g.color ?? '#7c5cff',
      })
      .select()
      .single()
    if (error) return { error: error.message }
    setGoals((prev) => [mapRow(data), ...prev])
    return { error: null }
  }

  async function updateGoal(id: string, patch: Partial<Pick<Goal, 'name' | 'icon' | 'targetAmount' | 'savedAmount' | 'deadline' | 'color'>>) {
    if (!userId) {
      setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...patch, savedAmount: patch.savedAmount ?? g.savedAmount, targetAmount: patch.targetAmount ?? g.targetAmount } : g))
      return { error: null as string | null }
    }
    const payload: any = {}
    if (patch.name !== undefined) payload.name = patch.name
    if (patch.icon !== undefined) payload.icon = patch.icon
    if (patch.targetAmount !== undefined) payload.target_amount = patch.targetAmount
    if (patch.savedAmount !== undefined) payload.saved_amount = patch.savedAmount
    if (patch.deadline !== undefined) payload.deadline = patch.deadline
    if (patch.color !== undefined) payload.color = patch.color

    const { error } = await supabase
      .from('goals')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
    if (error) return { error: error.message }
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, ...patch, savedAmount: patch.savedAmount ?? g.savedAmount, targetAmount: patch.targetAmount ?? g.targetAmount } : g))
    return { error: null }
  }

  async function deleteGoal(id: string) {
    if (!userId) {
      setGoals((prev) => prev.filter((g) => g.id !== id))
      return { error: null as string | null }
    }
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (!error) setGoals((prev) => prev.filter((g) => g.id !== id))
    return { error: error?.message ?? null }
  }

  return { goals, loading, addGoal, updateGoal, deleteGoal, refresh: fetchGoals }
}
