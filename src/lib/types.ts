export type FrequencyType = 'daily' | 'weekdays' | 'weekly' | 'monthly'
export type TimeOfDay = 'morning' | 'afternoon' | 'night' | 'anytime'

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  onboarding_completed: boolean
  dark_mode: boolean
  total_points: number
  level: string
  created_at: string
  updated_at: string
}

export interface Habit {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  frequency_type: FrequencyType
  frequency_days: number[]
  frequency_times_per_week: number
  duration_weeks: number | null
  time_of_day: TimeOfDay
  start_date: string
  reminder_time: string | null
  calendar_event_id: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface HabitCompletion {
  id: string
  habit_id: string
  user_id: string
  completed_at: string
  notes: string | null
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string | null
  due_date: string | null
  due_time?: string | null
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | null
  completed: boolean
  created_at: string
  updated_at: string
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
  emoji: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  badge?: Badge
}

export interface PointTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  habit_id: string | null
  created_at: string
}

export type Level = 'Iniciante' | 'Consistente' | 'Disciplinado' | 'Mestre'

export const LEVEL_THRESHOLDS: Record<Level, number> = {
  Iniciante: 0,
  Consistente: 500,
  Disciplinado: 2000,
  Mestre: 5000,
}

export const LEVEL_ORDER: Level[] = ['Iniciante', 'Consistente', 'Disciplinado', 'Mestre']
