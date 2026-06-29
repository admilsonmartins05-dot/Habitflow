'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Flame, Check, CheckCircle2, Circle, ChevronRight, AlertTriangle, CheckSquare, Square, CornerDownLeft, Calendar as CalendarIcon, CalendarOff, ExternalLink, Sun, Sunrise, Moon, ListTodo } from 'lucide-react'
import type { Habit, HabitCompletion, Profile, Task } from '@/lib/types'
import { isScheduledOn, calculateStreak, wasCompletedOn, wasVacationOn, sortHabitsByPeriod } from '@/lib/habits'
import { processCompletion, processTaskCompletion } from '@/lib/gamification'
import { getGoogleCalendarEvents, type CalendarEvent } from '@/lib/calendar'
import { TaskModal } from '@/components/TaskModal'
import { isSameDay, subDays, addDays, format, startOfDay, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import confetti from 'canvas-confetti'

function ConfettiEffect() {
  useEffect(() => {
    const count = 200
    const defaults = { origin: { y: 0.7 } }
    function fire(particleRatio: number, opts: object) {
      confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) })
    }
    fire(0.25, { spread: 26, startVelocity: 55 })
    fire(0.2, { spread: 60 })
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
    fire(0.1, { spread: 120, startVelocity: 45 })
  }, [])
  return null
}

function DashboardContent() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Record<string, HabitCompletion[]>>({})
  const [loading, setLoading] = useState(true)
  const [celebrating, setCelebrating] = useState(false)
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarNeedsAuth, setCalendarNeedsAuth] = useState(false)
  
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  
  type FilterType = 'hoje' | 'amanha' | 'semana' | '7dias'
  const [agendaFilter, setAgendaFilter] = useState<FilterType>('hoje')
  const [tasksFilter, setTasksFilter] = useState<FilterType>('hoje')

  const today = startOfDay(new Date())
  // The week tracker (Sunday to Saturday)
  const currentWeekDays = eachDayOfInterval({
    start: startOfWeek(today, { locale: ptBR }),
    end: endOfWeek(today, { locale: ptBR })
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [
      { data: p },
      { data: h },
      { data: c },
      { data: t },
      calData
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('habits').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
      supabase.from('habit_completions').select('*').eq('user_id', user.id)
        .gte('completed_at', subDays(new Date(), 90).toISOString()),
      supabase.from('tasks').select('*').eq('user_id', user.id)
        .or(`due_date.is.null,due_date.gte.${format(startOfDay(new Date()), 'yyyy-MM-dd')}`)
        .order('due_time', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true }),
      getGoogleCalendarEvents(),
    ])

    if (p) setProfile(p)
    if (h) {
      setHabits(h)
      const grouped: Record<string, HabitCompletion[]> = {}
      ;(c || []).forEach((comp: HabitCompletion) => {
        if (!grouped[comp.habit_id]) grouped[comp.habit_id] = []
        grouped[comp.habit_id].push(comp)
      })
      setCompletions(grouped)
    }
    if (t) setTasks(t)
    
    if (calData) {
      setCalendarEvents(calData.events)
      setCalendarNeedsAuth(calData.needsAuth)
    }

    setLoading(false)
  }, [supabase])

  const handleConnectCalendar = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  useEffect(() => { loadData() }, [loadData])

  const todayHabits = sortHabitsByPeriod(habits.filter(h => isScheduledOn(h, today)))
  const completedToday = todayHabits.filter(h => {
    const cs = completions[h.id] || []
    return wasCompletedOn(cs, today)
  })

  // Top streak habit
  const topStreakData = habits
    .map(h => ({ habit: h, ...calculateStreak(h, completions[h.id] || []) }))
    .sort((a, b) => b.currentStreak - a.currentStreak)[0]

  const handleComplete = async (habit: Habit, targetDate: Date = new Date()) => {
    if (!profile) return
    const cs = completions[habit.id] || []
    const alreadyDone = wasCompletedOn(cs, targetDate)
    if (alreadyDone || markingId) return

    setMarkingId(habit.id)

    const targetDateStr = targetDate.toISOString()

    const newComp: HabitCompletion = {
      id: 'temp-' + Date.now(),
      habit_id: habit.id,
      user_id: habit.user_id,
      completed_at: targetDateStr,
      notes: null,
      created_at: new Date().toISOString(),
    }
    const newCompletions = { ...completions, [habit.id]: [...cs, newComp] }
    setCompletions(newCompletions)

    const { data, error } = await supabase.from('habit_completions').insert({
      habit_id: habit.id,
      user_id: habit.user_id,
      completed_at: targetDateStr,
    }).select().single()

    if (error) {
      setCompletions(completions)
      setMarkingId(null)
      return
    }

    const updated = { ...newCompletions, [habit.id]: [...cs, data] }
    setCompletions(updated)

    const allHabitsData = habits.map(h => ({
      habit: h,
      completions: updated[h.id] || [],
    }))
    const result = await processCompletion(habit, updated[habit.id], allHabitsData, profile)
    setProfile(p => p ? { ...p, total_points: p.total_points + result.pointsAwarded } : p)

    const nowDone = todayHabits.filter(h => {
      if (h.id === habit.id) return true
      return wasCompletedOn(updated[h.id] || [], today)
    })
    if (nowDone.length === todayHabits.length && todayHabits.length > 0) {
      setCelebrating(true)
      setTimeout(() => setCelebrating(false), 3000)
    }

    setMarkingId(null)
  }

  const handleSaveTask = async (taskData: Partial<Task>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingTask) {
      const { data, error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id).select().single()
      if (!error && data) setTasks(tasks.map(t => t.id === data.id ? data : t))
    } else {
      const { data, error } = await supabase.from('tasks').insert({ ...taskData, user_id: user.id }).select().single()
      if (!error && data) setTasks([...tasks, data])
    }
    loadData()
  }

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) setTasks(tasks.filter(t => t.id !== taskId))
  }

  const handleToggleTask = async (task: Task) => {
    if (!profile || togglingTaskId) return
    setTogglingTaskId(task.id)

    const newStatus = !task.completed
    const { error } = await supabase.from('tasks').update({ completed: newStatus }).eq('id', task.id)

    if (!error) {
      setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: newStatus } : t))
      if (newStatus) {
        const result = await processTaskCompletion(task.id, task.title, profile)
        setProfile(p => p ? { ...p, total_points: p.total_points + result.pointsAwarded } : p)
        
        if (task.recurrence && task.recurrence !== 'none') {
          const nextDate = new Date(task.due_date || new Date())
          if (task.recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1)
          if (task.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
          if (task.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)

          await supabase.from('tasks').insert({
            user_id: task.user_id,
            title: task.title,
            description: task.description,
            due_date: format(nextDate, 'yyyy-MM-dd'),
            due_time: task.due_time,
            recurrence: task.recurrence,
          })
        }
      }
    }
    setTogglingTaskId(null)
  }

  if (loading) {
    return <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 0' }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12, borderRadius: 16 }} />)}
    </div>
  }

  const progressPct = todayHabits.length > 0 ? Math.round((completedToday.length / todayHabits.length) * 100) : 0
  const circumference = 2 * Math.PI * 22

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 40 }}>
      {celebrating && <ConfettiEffect />}
      
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
            Olá, {profile?.username?.split(' ')[0]}! 👋
          </h2>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>
            Seu dia
          </h1>
        </div>
        <Link href="/habitos/novo" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
          padding: '10px 16px', borderRadius: '14px',
          fontSize: 13, fontWeight: 800, textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
        }}>
          <Plus size={16} strokeWidth={3} /> Hábito
        </Link>
      </div>

      {/* Habits Progress Card */}
      <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
            Hábitos de hoje
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              {completedToday.length}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>
              /{todayHabits.length}
            </span>
          </div>
        </div>
        <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="28" cy="28" r="22" fill="none" stroke="var(--bg-input)" strokeWidth="6" />
            <circle cx="28" cy="28" r="22" fill="none" stroke="#6366f1" strokeWidth="6" 
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progressPct / 100) * circumference}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
            {progressPct}%
          </div>
        </div>
      </div>

      {/* Top Streak Banner */}
      {topStreakData && topStreakData.currentStreak > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #818cf8, #6366f1)', borderRadius: 16,
          padding: '20px 24px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 32, boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, background: 'rgba(255,255,255,0.2)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
            }}>
              {topStreakData.habit.emoji}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginBottom: 2 }}>Maior streak ativo</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{topStreakData.habit.name}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>
              <Flame size={20} color="white" fill="white" /> {topStreakData.currentStreak}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, marginTop: 4 }}>dias seguidos</div>
          </div>
        </div>
      )}

      {/* Agenda */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Agenda</h2>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', padding: 4, borderRadius: 8 }}>
            {(['hoje', 'amanha', 'semana', '7dias'] as FilterType[]).map(f => (
              <button key={f} onClick={() => setAgendaFilter(f)} style={{
                padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none',
                background: agendaFilter === f ? 'var(--bg-card)' : 'transparent',
                color: agendaFilter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: agendaFilter === f ? 'var(--shadow-sm)' : 'none',
              }}>
                {f === 'hoje' ? 'Hoje' : f === 'amanha' ? 'Amanhã' : f === 'semana' ? 'Semana' : '7 Dias'}
              </button>
            ))}
          </div>
        </div>
        {calendarNeedsAuth ? (
          <div className="card" style={{ padding: '32px 24px', textAlign: 'center', border: '1px dashed var(--border)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <CalendarOff size={24} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Conecte o Google Calendar
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px', lineHeight: 1.4 }}>
              Veja seus compromissos do dia direto aqui, junto com suas tarefas e hábitos.
            </p>
            <button onClick={handleConnectCalendar} style={{
              background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, margin: '0 auto'
            }}>
              Conectar calendário <ChevronRight size={16} />
            </button>
          </div>
        ) : calendarEvents.length === 0 ? (
          <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, border: '1px dashed var(--border)' }}>
            Nenhum compromisso na agenda hoje.
          </div>
        ) : (
          (() => {
            const filteredEvents = calendarEvents.filter(ev => {
              const d = startOfDay(new Date(ev.start))
              const todayDate = startOfDay(new Date())
              if (agendaFilter === 'hoje') return isSameDay(d, todayDate)
              if (agendaFilter === 'amanha') return isSameDay(d, addDays(todayDate, 1))
              if (agendaFilter === 'semana') return d >= todayDate && d <= endOfWeek(todayDate, { locale: ptBR })
              if (agendaFilter === '7dias') return d >= todayDate && d <= addDays(todayDate, 6)
              return false
            })
            
            if (filteredEvents.length === 0) {
              return <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, border: '1px dashed var(--border)' }}>Nenhum compromisso para este período.</div>
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredEvents.map((ev) => (
                  <a key={ev.id} href={ev.htmlLink} target="_blank" rel="noreferrer" className="card"
                    style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, flexShrink: 0, textAlign: 'center', lineHeight: 1.2 }}>
                      <div>{format(new Date(ev.start), 'dd/MM')}</div>
                      <div>{format(new Date(ev.start), 'HH:mm')}</div>
                    </div>
                    <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </div>
                  </a>
                ))}
              </div>
            )
          })()
        )}
      </div>

      {/* Tarefas */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListTodo size={18} /> Tarefas
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', padding: 4, borderRadius: 8 }}>
              {(['hoje', 'amanha', 'semana', '7dias'] as FilterType[]).map(f => (
                <button key={f} onClick={() => setTasksFilter(f)} style={{
                  padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: tasksFilter === f ? 'var(--bg-card)' : 'transparent',
                  color: tasksFilter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: tasksFilter === f ? 'var(--shadow-sm)' : 'none',
                }}>
                  {f === 'hoje' ? 'Hoje' : f === 'amanha' ? 'Amanhã' : f === 'semana' ? 'Semana' : '7 Dias'}
                </button>
              ))}
            </div>
            <button onClick={() => { setEditingTask(null); setTaskModalOpen(true) }}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0
              }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AnimatePresence>
            {(() => {
              const filteredTasks = tasks.filter(task => {
                if (!task.due_date) return tasksFilter === 'hoje' || tasksFilter === 'semana' || tasksFilter === '7dias' // Anytime tasks show in broader views
                const d = startOfDay(parseISO(task.due_date))
                const todayDate = startOfDay(new Date())
                if (tasksFilter === 'hoje') return isSameDay(d, todayDate)
                if (tasksFilter === 'amanha') return isSameDay(d, addDays(todayDate, 1))
                if (tasksFilter === 'semana') return d >= todayDate && d <= endOfWeek(todayDate, { locale: ptBR })
                if (tasksFilter === '7dias') return d >= todayDate && d <= addDays(todayDate, 6)
                return false
              })

              if (filteredTasks.length === 0) {
                return (
                  <div className="card" style={{ padding: '32px 20px', textAlign: 'center', border: '1px dashed var(--border)', background: 'transparent' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--text-muted)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Check size={16} />
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>Nenhuma tarefa para este período</div>
                  </div>
                )
              }

              return filteredTasks.map((task) => (
              <motion.div key={task.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: task.completed ? 0.6 : 1, cursor: 'pointer' }}
                onClick={(e) => { if ((e.target as any).closest('button')) return; setEditingTask(task); setTaskModalOpen(true) }}>
                <button onClick={(e) => { e.stopPropagation(); handleToggleTask(task) }} disabled={togglingTaskId === task.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: task.completed ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {task.title}
                  </div>
                  {task.due_time && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>🕒 {task.due_date ? format(parseISO(task.due_date), 'dd/MM') + ' às ' : ''}{task.due_time.substring(0, 5)}</div>}
                </div>
              </motion.div>
            ))
            })()}
          </AnimatePresence>
        </div>
      </div>

      {/* Habits List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {['morning', 'afternoon', 'night', 'anytime'].map(period => {
          const habitsInPeriod = todayHabits.filter(h => h.time_of_day === period)
          if (habitsInPeriod.length === 0) return null

          const periodIcons: Record<string, React.ReactNode> = {
            'morning': <Sunrise size={18} color="var(--text-muted)" />,
            'afternoon': <Sun size={18} color="var(--text-muted)" />,
            'night': <Moon size={18} color="var(--text-muted)" />,
            'anytime': <ListTodo size={18} color="var(--text-muted)" />
          }
          
          const periodNames: Record<string, string> = {
            'morning': 'Matinal',
            'afternoon': 'Diurno',
            'night': 'Noturno',
            'anytime': 'Qualquer horário'
          }

          return (
            <div key={period}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {periodIcons[period]}
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)' }}>
                  {periodNames[period]}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                  {habitsInPeriod.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {habitsInPeriod.map(habit => {
                  const cs = completions[habit.id] || []
                  const isDone = wasCompletedOn(cs, today)
                  const streakData = calculateStreak(habit, cs)
                  
                  return (
                    <div key={habit.id} className="card" 
                         onClick={() => router.push(`/habitos/${habit.id}`)}
                         style={{ padding: '12px 16px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, background: 'var(--accent-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                        }}>
                          {habit.emoji}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 0 }}>
                            {habit.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                            {habit.frequency_type === 'daily' ? 'Todos os dias' :
                             habit.frequency_type === 'weekdays' ? `${habit.frequency_days?.length || 0} dias por semana` :
                             habit.frequency_type === 'weekly' ? `${habit.frequency_times_per_week || 1}x na semana` : 'Mensalmente'}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleComplete(habit); }}
                          disabled={markingId === habit.id || isDone}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: isDone ? '#6366f1' : 'transparent',
                            border: `2px solid ${isDone ? '#6366f1' : 'var(--border-dark)'}`,
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: isDone ? 'default' : 'pointer', transition: 'all 0.2s', flexShrink: 0
                          }}
                        >
                          {isDone && <Check size={16} strokeWidth={3} />}
                        </button>
                      </div>

                      {/* Week Tracker */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {currentWeekDays.map((date, idx) => {
                            const dayLetter = format(date, 'EEEEEE', { locale: ptBR })[0].toUpperCase()
                            const isCompleted = wasCompletedOn(cs, startOfDay(date))
                            const isVacation = wasVacationOn(cs, startOfDay(date))
                            const isToday = isSameDay(date, today)
                            const isFuture = date > today

                            return (
                              <button key={idx} 
                                onClick={(e) => { 
                                  e.preventDefault(); e.stopPropagation();
                                  if (!isFuture && !isCompleted && !isVacation && markingId !== habit.id) handleComplete(habit, date) 
                                }}
                                disabled={isFuture || isCompleted || isVacation || markingId === habit.id}
                                style={{
                                width: 22, height: 22, borderRadius: '50%', padding: 0, margin: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 800,
                                background: isVacation ? '#38bdf8' : (isCompleted ? '#6366f1' : 'transparent'),
                                color: isVacation ? 'white' : (isCompleted ? 'white' : (isFuture ? 'var(--border-dark)' : 'var(--text-secondary)')),
                                border: `1px solid ${isVacation ? '#38bdf8' : (isCompleted ? '#6366f1' : 'var(--border)')}`,
                                opacity: isFuture ? 0.4 : 1,
                                cursor: (isFuture || isCompleted || isVacation) ? 'default' : 'pointer',
                                transition: 'all 0.2s',
                              }}>
                                {dayLetter}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {!isDone && <AlertTriangle size={14} color="#f59e0b" />}
                          <Flame size={16} color="#f97316" fill={streakData.currentStreak > 0 ? "#f97316" : "none"} /> 
                          {streakData.currentStreak}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 0' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 120, marginBottom: 12, borderRadius: 16 }} />
        ))}
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
