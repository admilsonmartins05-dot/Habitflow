'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Archive, TrendingUp } from 'lucide-react'
import type { Habit, HabitCompletion } from '@/lib/types'
import { calculateStreak, calculateCompletionRate, sortHabitsByPeriod } from '@/lib/habits'

export default function HabitosPage() {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [archived, setArchived] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Record<string, HabitCompletion[]>>({})
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: h }, { data: c }] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('habit_completions').select('*').eq('user_id', user.id),
      ])
      const active = sortHabitsByPeriod((h || []).filter((x: Habit) => !x.archived))
      const arch = (h || []).filter((x: Habit) => x.archived)
      setHabits(active)
      setArchived(arch)
      const grouped: Record<string, HabitCompletion[]> = {}
      ;(c || []).forEach((comp: HabitCompletion) => {
        if (!grouped[comp.habit_id]) grouped[comp.habit_id] = []
        grouped[comp.habit_id].push(comp)
      })
      setCompletions(grouped)
      setLoading(false)
    }
    load()
  }, [])

  const HabitRow = ({ habit }: { habit: Habit }) => {
    const cs = completions[habit.id] || []
    const { currentStreak } = calculateStreak(habit, cs)
    const rate = calculateCompletionRate(habit, cs)
    return (
      <Link href={`/habitos/${habit.id}`} style={{ textDecoration: 'none' }}>
        <div className="card" style={{
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
          borderLeft: `4px solid ${habit.color}`, cursor: 'pointer',
          transition: 'transform 0.2s',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${habit.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {habit.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {habit.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {habit.frequency_type === 'daily' ? 'Diário' :
                  habit.frequency_type === 'weekdays' ? `${habit.frequency_days.length}x/semana` :
                  habit.frequency_type === 'weekly' ? `${habit.frequency_times_per_week}x/semana` : 'Mensal'}
              </span>
              {currentStreak > 0 && (
                <span className="streak-badge" style={{ fontSize: 11, padding: '2px 7px' }}>
                  🔥 {currentStreak}d
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: habit.color }}>{rate}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>conclusão</div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Meus Hábitos</h1>
        <Link href="/habitos/novo" className="btn btn-primary">
          <Plus size={16} /> Novo Hábito
        </Link>
      </div>

      {loading ? (
        [...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 76, marginBottom: 10, borderRadius: 12 }} />
        ))
      ) : habits.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🌱</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Nenhum hábito ainda</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Comece criando seu primeiro hábito e transforme sua rotina!
          </p>
          <Link href="/habitos/novo" className="btn btn-primary btn-lg">
            <Plus size={18} /> Criar primeiro hábito
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {habits.map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <HabitRow habit={h} />
            </motion.div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowArchived(!showArchived)}
            style={{ marginBottom: 12 }}
          >
            <Archive size={16} />
            {showArchived ? 'Ocultar' : 'Ver'} hábitos arquivados ({archived.length})
          </button>
          {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
              {archived.map(h => <HabitRow key={h.id} habit={h} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
