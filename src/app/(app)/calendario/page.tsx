'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, startOfYear, endOfYear,
  isSameMonth, isSameDay, parseISO, startOfDay, addMonths, subMonths, getDay, addDays
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, CheckSquare, Square, Calendar as CalendarIcon, Clock, Filter, CheckCircle2, Search } from 'lucide-react'
import type { Habit, HabitCompletion, Task } from '@/lib/types'
import { isScheduledOn, wasCompletedOn, wasVacationOn } from '@/lib/habits'
import { getGoogleCalendarEvents, type CalendarEvent } from '@/lib/calendar'
import { TaskModal } from '@/components/TaskModal'
import { processTaskCompletion } from '@/lib/gamification'

type TimeFilter = 'hoje' | 'semana' | '7dias' | 'mes' | 'ano' | 'custom'
type TypeFilter = 'tudo' | 'tarefas' | 'agenda'

export default function CalendarioPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'habitos' | 'agenda'>('habitos')
  
  // Habitos state
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Record<string, HabitCompletion[]>>({})
  const [loadingHabits, setLoadingHabits] = useState(true)

  // Agenda state
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadingAgenda, setLoadingAgenda] = useState(false)
  
  const [agendaTimeFilter, setAgendaTimeFilter] = useState<TimeFilter>('mes')
  const [agendaTypeFilter, setAgendaTypeFilter] = useState<TypeFilter>('tudo')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Shared state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [userId, setUserId] = useState<string | null>(null)
  
  // Task Modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    init()
  }, [])

  // Fetch Habitos
  useEffect(() => {
    const loadHabitos = async () => {
      if (!userId) return
      setLoadingHabits(true)
      const [{ data: h }, { data: c }] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', userId).eq('archived', false),
        supabase.from('habit_completions').select('*').eq('user_id', userId),
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
      setLoadingHabits(false)
    }
    loadHabitos()
  }, [userId])

  // Fetch Agenda
  useEffect(() => {
    const loadAgenda = async () => {
      if (!userId || activeTab !== 'agenda') return
      setLoadingAgenda(true)
      
      let start: Date
      let end: Date
      const todayDate = startOfDay(new Date())

      switch (agendaTimeFilter) {
        case 'hoje':
          start = todayDate
          end = new Date(todayDate)
          break
        case 'semana':
          start = startOfWeek(todayDate, { locale: ptBR })
          end = endOfWeek(todayDate, { locale: ptBR })
          break
        case '7dias':
          start = todayDate
          end = addDays(todayDate, 6)
          break
        case 'ano':
          start = startOfYear(todayDate)
          end = endOfYear(todayDate)
          break
        case 'custom':
          start = customStart ? new Date(customStart + 'T00:00:00') : todayDate
          end = customEnd ? new Date(customEnd + 'T23:59:59') : todayDate
          break
        case 'mes':
        default:
          start = startOfMonth(currentMonth)
          end = endOfMonth(currentMonth)
          break
      }

      start.setHours(0,0,0,0)
      end.setHours(23,59,59,999)
      
      if (end < start) {
        setLoadingAgenda(false)
        return
      }
      
      const startStr = start.toISOString()
      const endStr = end.toISOString()
      
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('due_date', startStr.substring(0, 10))
        .lte('due_date', endStr.substring(0, 10))
      
      setTasks(tasksData || [])
      
      const { events: eventsData } = await getGoogleCalendarEvents(start, end)
      setEvents(eventsData || [])
      
      setLoadingAgenda(false)
    }
    loadAgenda()
  }, [userId, currentMonth, activeTab, agendaTimeFilter, customStart, customEnd])

  // Handlers for Tasks
  const handleToggleTask = async (task: Task) => {
    setTogglingTaskId(task.id)
    const isNowCompleted = !task.completed
    await supabase.from('tasks').update({ completed: isNowCompleted }).eq('id', task.id)
    
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: isNowCompleted } : t))
    
    if (isNowCompleted && userId) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (profile) await processTaskCompletion(task.id, task.title, profile)
    }
    setTogglingTaskId(null)
  }

  const handleSaveTask = async (task: Partial<Task>) => {
    if (!task.id) return
    setTasks(prev => {
      const exists = prev.find(t => t.id === task.id)
      if (exists) return prev.map(t => t.id === task.id ? { ...t, ...task } as Task : t)
      return [...prev, task as Task]
    })
    setTaskModalOpen(false)
  }

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setTaskModalOpen(false)
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const today = startOfDay(new Date())

  const startPad = getDay(monthStart)
  const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  const getDayInfo = (day: Date) => {
    const scheduled = habits.filter(h => isScheduledOn(h, day))
    const done = scheduled.filter(h => {
      const cs = completions[h.id] || []
      return wasCompletedOn(cs, day) || wasVacationOn(cs, day)
    })
    return { scheduled, done }
  }

  const renderHabitos = () => {
    if (loadingHabits) {
      return <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />
    }

    return (
      <>
        {/* Month Navigation Header - Only for Habitos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Mês</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 15, minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {WEEKDAYS_SHORT.map((d, i) => (
              <div key={i} style={{
                textAlign: 'center', fontSize: 12, fontWeight: 700,
                color: 'var(--text-muted)', padding: '4px 0',
              }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map(day => {
              const { scheduled, done } = getDayInfo(day)
              const isToday = isSameDay(day, today)
              const allDone = scheduled.length > 0 && done.length === scheduled.length
              const someDone = done.length > 0 && done.length < scheduled.length
              const isFuture = day > today

              return (
                <div
                  key={day.toISOString()}
                  style={{
                    aspectRatio: '1', borderRadius: 10,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    background: isToday
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : allDone
                      ? '#dcfce7'
                      : someDone
                      ? '#fef3c7'
                      : 'transparent',
                    border: isToday ? 'none' : '1px solid var(--border-light)',
                    opacity: isFuture ? 0.4 : 1,
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: isToday ? 800 : 600,
                    color: isToday ? 'white' : allDone ? '#166534' : 'var(--text-primary)',
                    lineHeight: 1,
                  }}>
                    {format(day, 'd')}
                  </span>
                  {scheduled.length > 0 && !isFuture && (
                    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {scheduled.slice(0, 4).map(h => {
                        const completed = done.some(d => d.id === h.id)
                        return (
                          <div
                            key={h.id}
                            style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: completed ? h.color : 'var(--border)',
                            }}
                          />
                        )
                      })}
                      {scheduled.length > 4 && (
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>+{scheduled.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { color: '#dcfce7', border: 'none', label: 'Todos concluídos' },
              { color: '#fef3c7', border: 'none', label: 'Parcialmente' },
              { color: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', label: 'Hoje' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
            Hábitos de hoje — {format(today, "dd 'de' MMMM", { locale: ptBR })}
          </h2>
          {habits.filter(h => isScheduledOn(h, today)).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nenhum hábito agendado para hoje.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {habits.filter(h => isScheduledOn(h, today)).map(h => {
                const cs = completions[h.id] || []
                const done = wasCompletedOn(cs, today) || wasVacationOn(cs, today)
                return (
                  <div key={h.id} className="card" style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    borderLeft: `3px solid ${h.color}`,
                  }}>
                    <span style={{ fontSize: 20 }}>{h.emoji}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{h.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: done ? '#22c55e' : 'var(--text-muted)' }}>
                      {done ? '✅ Feito' : '⏳ Pendente'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </>
    )
  }

  const renderAgenda = () => {
    // Group items by day
    const groupedItems: Record<string, { tasks: Task[], events: CalendarEvent[] }> = {}
    const daysWithContent = new Set<string>()

    const normalizedSearch = searchQuery.toLowerCase().trim()

    if (agendaTypeFilter === 'tudo' || agendaTypeFilter === 'tarefas') {
      tasks.forEach(task => {
        if (task.due_date) {
          if (normalizedSearch && !task.title.toLowerCase().includes(normalizedSearch)) return
          
          const dStr = task.due_date
          daysWithContent.add(dStr)
          if (!groupedItems[dStr]) groupedItems[dStr] = { tasks: [], events: [] }
          groupedItems[dStr].tasks.push(task)
        }
      })
    }

    if (agendaTypeFilter === 'tudo' || agendaTypeFilter === 'agenda') {
      events.forEach(event => {
        if (normalizedSearch && !event.title.toLowerCase().includes(normalizedSearch)) return

        const dStr = format(event.start, 'yyyy-MM-dd')
        daysWithContent.add(dStr)
        if (!groupedItems[dStr]) groupedItems[dStr] = { tasks: [], events: [] }
        groupedItems[dStr].events.push(event)
      })
    }

    const sortedDates = Array.from(daysWithContent).sort()

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Filters Toolbar */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            {/* Type Filters */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', padding: 4, borderRadius: 8 }}>
              {(['tudo', 'tarefas', 'agenda'] as TypeFilter[]).map(t => (
                <button key={t} onClick={() => setAgendaTypeFilter(t)} style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: agendaTypeFilter === t ? 'var(--bg-card)' : 'transparent',
                  color: agendaTypeFilter === t ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: agendaTypeFilter === t ? 'var(--shadow-sm)' : 'none',
                }}>
                  {t === 'tudo' ? 'Ver Tudo' : t === 'tarefas' ? 'Só Tarefas' : 'Só Agenda'}
                </button>
              ))}
            </div>

            {/* Nova Tarefa Button */}
            <button onClick={() => { setEditingTask(null); setTaskModalOpen(true) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                padding: '8px 16px', borderRadius: '8px',
                fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}>
              <Plus size={16} strokeWidth={3} /> Nova Tarefa
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, left: 12, color: 'var(--text-muted)' }}>
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Pesquisar por compromissos ou tarefas..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', outline: 'none', fontSize: 13, fontWeight: 600
              }}
            />
          </div>

          {/* Time Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Filter size={14} color="var(--text-muted)" style={{ marginRight: 4 }} />
            {(['hoje', 'semana', '7dias', 'mes', 'ano', 'custom'] as TimeFilter[]).map(t => (
              <button key={t} onClick={() => setAgendaTimeFilter(t)} style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                background: agendaTimeFilter === t ? 'var(--accent)' : 'transparent',
                color: agendaTimeFilter === t ? 'white' : 'var(--text-muted)',
                border: agendaTimeFilter === t ? '1px solid var(--accent)' : '1px solid var(--border)',
                transition: 'all 0.2s'
              }}>
                {t === 'hoje' ? 'Hoje' : t === 'semana' ? 'Esta Semana' : t === '7dias' ? 'Próx 7 Dias' : t === 'mes' ? 'Mês' : t === 'ano' ? 'Ano' : 'Personalizar'}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs (only shown when custom is selected) */}
          <AnimatePresence>
            {agendaTimeFilter === 'custom' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>Data de Início</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', fontSize: 13, fontWeight: 600 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>Data Final</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', fontSize: 13, fontWeight: 600 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Month Navigation (Only shown when time filter is 'mes') */}
          <AnimatePresence>
            {agendaTimeFilter === 'mes' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: 800, fontSize: 14, minWidth: 120, textAlign: 'center', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button className="btn btn-ghost btn-icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {loadingAgenda ? (
          <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />
        ) : sortedDates.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', background: 'transparent', border: '1px dashed var(--border)' }}>
            <CalendarIcon size={32} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
              Nenhum item agendado neste período!
            </div>
          </div>
        ) : (
          sortedDates.map(dateStr => {
            const dateObj = parseISO(dateStr)
            const { tasks: dayTasks, events: dayEvents } = groupedItems[dateStr]
            const isToday = isSameDay(dateObj, today)

            return (
              <div key={dateStr}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ 
                    background: isToday ? 'var(--accent)' : 'var(--bg-card)', 
                    color: isToday ? 'white' : 'var(--text-secondary)',
                    width: 44, height: 44, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: isToday ? 'none' : '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>{format(dateObj, 'MMM', { locale: ptBR })}</span>
                    <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{format(dateObj, 'dd')}</span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {format(dateObj, 'EEEE', { locale: ptBR })}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 56 }}>
                  {/* Google Calendar Events */}
                  {dayEvents.map(event => (
                    <a key={event.id} href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                      className="card" style={{ 
                        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                        textDecoration: 'none', borderLeft: '3px solid #3b82f6',
                        background: 'rgba(59, 130, 246, 0.05)'
                      }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>{event.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Clock size={12} />
                          {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                        </div>
                      </div>
                    </a>
                  ))}

                  {/* Tasks */}
                  {dayTasks.map(task => (
                    <div key={task.id} className="card"
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: task.completed ? 0.6 : 1, cursor: 'pointer' }}
                      onClick={(e) => { if ((e.target as any).closest('button')) return; setEditingTask(task); setTaskModalOpen(true) }}>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleTask(task) }} disabled={togglingTaskId === task.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: task.completed ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {task.title}
                        </div>
                        {task.due_time && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>🕒 {task.due_time.substring(0, 5)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 40 }}>
      {/* Page Title */}
      <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 20 }}>Calendário</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', padding: 4, borderRadius: 12, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('habitos')}
          style={{
            flex: 1, padding: '10px', fontSize: 13, fontWeight: 800, borderRadius: 8, cursor: 'pointer', border: 'none',
            background: activeTab === 'habitos' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'habitos' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'habitos' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          Consistência de Hábitos
        </button>
        <button
          onClick={() => setActiveTab('agenda')}
          style={{
            flex: 1, padding: '10px', fontSize: 13, fontWeight: 800, borderRadius: 8, cursor: 'pointer', border: 'none',
            background: activeTab === 'agenda' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'agenda' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'agenda' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          Agenda e Tarefas
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'habitos' ? renderHabitos() : renderAgenda()}
        </motion.div>
      </AnimatePresence>

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
