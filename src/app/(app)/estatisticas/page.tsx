'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import type { Habit, HabitCompletion } from '@/lib/types'
import { calculateStreak, calculateCompletionRate } from '@/lib/habits'
import { startOfWeek, endOfWeek, startOfMonth, eachDayOfInterval, isSameDay, parseISO, startOfDay, subWeeks, subDays, format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Award, AlertCircle, Flame } from 'lucide-react'

export default function EstatisticasPage() {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Record<string, HabitCompletion[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: h }, { data: c }] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', user.id).eq('archived', false),
        supabase.from('habit_completions').select('*').eq('user_id', user.id)
      ])
      if (h) setHabits(h)
      if (c) {
        const grouped: Record<string, HabitCompletion[]> = {}
        ;(c || []).forEach((comp: HabitCompletion) => {
          if (!grouped[comp.habit_id]) grouped[comp.habit_id] = []
          grouped[comp.habit_id].push(comp)
        })
        setCompletions(grouped)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const today = startOfDay(new Date())
  const currentWeekStart = startOfWeek(today, { locale: ptBR })
  const prevWeekStart = subWeeks(currentWeekStart, 1)
  const prevWeekEnd = endOfWeek(prevWeekStart, { locale: ptBR })
  const currentMonthStart = startOfMonth(today)
  const thirtyDaysAgo = subDays(today, 29)

  // Evolution data (30 days)
  const evolutionData = eachDayOfInterval({ start: thirtyDaysAgo, end: today }).map(d => {
    const totalDone = habits.reduce((sum, h) => {
      const cs = completions[h.id] || []
      const done = cs.some(c => isSameDay(startOfDay(parseISO(c.completed_at)), d))
      return sum + (done ? 1 : 0)
    }, 0)
    return {
      date: format(d, 'dd/MM'),
      completions: totalDone
    }
  })

  // Current vs prev week totals
  const getCompletionsInInterval = (start: Date, end: Date) => {
    const days = eachDayOfInterval({ start, end })
    return habits.reduce((sum, h) => {
      const cs = completions[h.id] || []
      return sum + days.filter(d => cs.some(c => isSameDay(startOfDay(parseISO(c.completed_at)), d))).length
    }, 0)
  }
  const thisWeekTotal = getCompletionsInInterval(currentWeekStart, today)
  const prevWeekTotal = getCompletionsInInterval(prevWeekStart, prevWeekEnd)
  const weekDiff = thisWeekTotal - prevWeekTotal
  const weekDiffPct = prevWeekTotal > 0 ? Math.round((weekDiff / prevWeekTotal) * 100) : (thisWeekTotal > 0 ? 100 : 0)

  // Habit stats calculation
  const habitStats = habits.map(h => {
    const cs = completions[h.id] || []
    const rate = calculateCompletionRate(h, cs)
    const streak = calculateStreak(h, cs).currentStreak
    
    // Calculate week %
    const weekDays = eachDayOfInterval({ start: currentWeekStart, end: today })
    // In a real app we'd filter scheduled days, here we approximate with calculateCompletionRate logic for a subset
    // or just assume 100% if done all days. Let's do simple:
    const weekDone = weekDays.filter(d => cs.some(c => isSameDay(startOfDay(parseISO(c.completed_at)), d))).length
    // Assuming habit is scheduled every day for simplicity in UI if we don't calculate exact schedule
    // A better approximation:
    let weekExpected = weekDays.length
    if (h.frequency_type === 'weekdays' && h.frequency_days) {
      weekExpected = weekDays.filter(d => h.frequency_days?.includes(d.getDay())).length
    } else if (h.frequency_type === 'weekly') {
      weekExpected = (h.frequency_times_per_week || 1)
    }
    const weekPct = weekExpected > 0 ? Math.min(100, Math.round((weekDone / weekExpected) * 100)) : 0

    // Month %
    const monthDays = eachDayOfInterval({ start: currentMonthStart, end: today })
    const monthDone = monthDays.filter(d => cs.some(c => isSameDay(startOfDay(parseISO(c.completed_at)), d))).length
    let monthExpected = monthDays.length
    if (h.frequency_type === 'weekdays' && h.frequency_days) {
      monthExpected = monthDays.filter(d => h.frequency_days?.includes(d.getDay())).length
    } else if (h.frequency_type === 'weekly') {
      const weeksInMonth = Math.ceil(monthDays.length / 7)
      monthExpected = (h.frequency_times_per_week || 1) * weeksInMonth
    }
    const monthPct = monthExpected > 0 ? Math.min(100, Math.round((monthDone / monthExpected) * 100)) : 0

    return { habit: h, rate, streak, weekPct, monthPct, totalPct: rate }
  }).sort((a, b) => b.rate - a.rate)

  const mostConsistent = habitStats.length > 0 ? habitStats[0] : null
  const leastConsistent = habitStats.length > 1 ? habitStats[habitStats.length - 1] : null

  if (loading) {
    return <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 0' }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 200, marginBottom: 16, borderRadius: 12 }} />)}
    </div>
  }

  // Calculate comparative bar heights (max height = 80px)
  const maxWeekly = Math.max(thisWeekTotal, prevWeekTotal, 1) // avoid div by 0
  const prevBarHeight = (prevWeekTotal / maxWeekly) * 80
  const currentBarHeight = (thisWeekTotal / maxWeekly) * 80

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 24, color: 'var(--text-primary)' }}>
        Estatísticas
      </h1>

      {/* Comparativo semanal */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>
          Comparativo semanal
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '20%', height: 100, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 120 }}>
            <div style={{ width: '100%', height: prevBarHeight || 4, background: 'var(--bg-input)', borderRadius: '8px 8px 0 0', transition: 'height 0.5s' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Sem. passada</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 120 }}>
            <div style={{ width: '100%', height: currentBarHeight || 4, background: '#6366f1', borderRadius: '8px 8px 0 0', transition: 'height 0.5s' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Sem. atual</span>
          </div>

          <div style={{ position: 'absolute', right: 0, top: '20%', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: weekDiff >= 0 ? '#22c55e' : '#ef4444', fontWeight: 800, fontSize: 20 }}>
              {weekDiff >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {weekDiff >= 0 ? '+' : ''}{weekDiffPct}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>vs anterior</div>
          </div>
        </div>
      </div>

      {/* Evolução 30 dias */}
      <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>
          Evolução da conclusão (30 dias)
        </h2>
        <div style={{ height: 200, marginLeft: -20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                interval={6} // Show roughly 5 labels
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                width={40}
              />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
              />
              <Line 
                type="monotone" 
                dataKey="completions" 
                name="Conclusões"
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 6, fill: '#6366f1', stroke: 'var(--bg-card)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Destaques */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {mostConsistent && (
          <div className="card" style={{ flex: 1, padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <Award size={16} /> Mais consistente
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>{mostConsistent.habit.emoji}</span> {mostConsistent.habit.name}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e' }}>{mostConsistent.rate}%</div>
          </div>
        )}
        {leastConsistent && leastConsistent.habit.id !== mostConsistent?.habit.id && (
          <div className="card" style={{ flex: 1, padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <AlertCircle size={16} /> Mais negligenciado
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>{leastConsistent.habit.emoji}</span> {leastConsistent.habit.name}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>{leastConsistent.rate}%</div>
          </div>
        )}
      </div>

      {/* Taxa de conclusão por hábito */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
        Taxa de conclusão por hábito
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {habitStats.map(({ habit, streak, weekPct, monthPct, totalPct }) => (
          <div key={habit.id} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'var(--bg-input)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                }}>
                  {habit.emoji}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {habit.name}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                <Flame size={16} color="#f97316" /> {streak}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', marginBottom: 16, padding: '0 10%' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Semana</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{weekPct}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Mês</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{monthPct}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{totalPct}%</div>
              </div>
            </div>

            <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${totalPct}%`, height: '100%', background: '#6366f1', borderRadius: 4, transition: 'width 1s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
