'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, Archive, Edit2, CheckCircle2, Circle, Flame, Target, TrendingUp, BarChart2 } from 'lucide-react'
import type { Habit, HabitCompletion } from '@/lib/types'
import {
  calculateStreak,
  calculateCompletionRate,
  getProgressGrid,
  wasCompletedOn,
  isScheduledOn,
} from '@/lib/habits'
import { isSameDay, parseISO, startOfDay, subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function HabitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [habit, setHabit] = useState<Habit | null>(null)
  const [completions, setCompletions] = useState<HabitCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadData = useCallback(async () => {
    const [{ data: h }, { data: c }] = await Promise.all([
      supabase.from('habits').select('*').eq('id', id).single(),
      supabase.from('habit_completions').select('*').eq('habit_id', id).order('completed_at'),
    ])
    if (h) setHabit(h)
    if (c) setCompletions(c)
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleToggle = async (date: Date) => {
    if (!habit) return
    const today = startOfDay(new Date())
    const threeDaysAgo = subDays(today, 3)

    // Only allow marking today and last 3 days
    if (date > today || date < threeDaysAgo) return

    const existing = completions.find(c =>
      isSameDay(startOfDay(parseISO(c.completed_at)), date)
    )

    if (existing) {
      // Unmark
      await supabase.from('habit_completions').delete().eq('id', existing.id)
      setCompletions(cs => cs.filter(c => c.id !== existing.id))
      showToast('Marcação removida')
    } else {
      // Mark
      const dateStr = format(date, "yyyy-MM-dd'T'12:00:00xxx")
      const { data, error } = await supabase.from('habit_completions').insert({
        habit_id: habit.id,
        user_id: habit.user_id,
        completed_at: date.toISOString(),
      }).select().single()
      if (!error && data) {
        setCompletions(cs => [...cs, data])
        showToast('Hábito marcado! ✅')
      }
    }
  }

  const handleArchive = async () => {
    if (!habit || !confirm('Arquivar este hábito? O histórico será preservado.')) return
    await supabase.from('habits').update({ archived: true }).eq('id', habit.id)
    router.push('/habitos')
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12, borderRadius: 12 }} />
        ))}
      </div>
    )
  }

  if (!habit) return <div>Hábito não encontrado</div>

  const { currentStreak, bestStreak } = calculateStreak(habit, completions)
  const completionRate = calculateCompletionRate(habit, completions)
  const grid = getProgressGrid(habit, completions)
  const today = startOfDay(new Date())
  const todayDone = wasCompletedOn(completions, today)
  const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>{habit.emoji}</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{habit.name}</h1>
          </div>
        </div>
        <Link href={`/habitos/${habit.id}/editar`} className="btn btn-ghost btn-sm" title="Editar">
          <Edit2 size={16} />
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={handleArchive} title="Arquivar">
          <Archive size={16} />
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { icon: Flame, label: 'Streak atual', value: `${currentStreak}d`, color: '#f97316' },
          { icon: TrendingUp, label: 'Melhor streak', value: `${bestStreak}d`, color: '#6366f1' },
          { icon: Target, label: 'Conclusão', value: `${completionRate}%`, color: '#22c55e' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card" style={{ padding: '16px 14px', textAlign: 'center' }}>
            <Icon size={20} color={color} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Today quick mark */}
      {isScheduledOn(habit, today) && (
        <div className="card" style={{
          padding: '18px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderLeft: `4px solid ${habit.color}`,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Hoje</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {todayDone ? '✅ Concluído!' : 'Pendente'}
            </div>
          </div>
          <button
            onClick={() => handleToggle(today)}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: todayDone ? 'none' : `2.5px solid ${habit.color}`,
              background: todayDone ? habit.color : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          >
            {todayDone ? <CheckCircle2 size={22} color="white" /> : <Circle size={22} color={habit.color} />}
          </button>
        </div>
      )}

      {/* Progress Grid */}
      <div className="card" style={{ padding: '20px', marginBottom: 24, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BarChart2 size={18} color="var(--text-secondary)" />
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Grade de progresso</h2>
        </div>

        {/* Weekday header */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, paddingLeft: 80 }}>
          {WEEKDAY_NAMES.map(d => (
            <div key={d} style={{
              width: 28, textAlign: 'center', fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>{d}</div>
          ))}
        </div>

        {/* Grid rows (by week) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grid.map(({ week, days }) => (
            <div key={week} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 76, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                textAlign: 'right', paddingRight: 8, flexShrink: 0,
              }}>
                Sem {week}
              </div>
              {days.map(({ date, scheduled, completed, vacation }) => {
                const isFuture = date > today
                const isToday = isSameDay(date, today)
                const canToggle = !isFuture && date >= subDays(today, 3)

                return (
                  <div
                    key={date.toISOString()}
                    className={`habit-cell tooltip ${completed ? 'completed' : ''} ${!scheduled ? 'not-scheduled' : ''}`}
                    data-tip={format(date, 'dd/MM', { locale: ptBR })}
                    style={{
                      background: vacation ? '#38bdf8' : (completed ? habit.color : undefined),
                      opacity: isFuture ? 0.3 : 1,
                      cursor: scheduled && canToggle && !vacation ? 'pointer' : 'default',
                      outline: isToday ? `2px solid ${habit.color}` : undefined,
                      outlineOffset: 2,
                    }}
                    onClick={() => scheduled && canToggle && handleToggle(date)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { color: habit.color, label: 'Concluído' },
            { color: '#38bdf8', label: 'Férias' },
            { color: 'var(--border)', label: 'Pendente' },
            { color: 'var(--border-light)', label: 'Não agendado' },
          ].map(({ color: c, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
