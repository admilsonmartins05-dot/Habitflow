import { addDays, differenceInDays, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Habit, HabitCompletion } from './types'

export type { Habit, HabitCompletion }

const PERIOD_ORDER: Record<string, number> = {
  morning: 1,
  afternoon: 2,
  night: 3,
  anytime: 4,
}

export function sortHabitsByPeriod(habits: Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    return (PERIOD_ORDER[a.time_of_day] || 4) - (PERIOD_ORDER[b.time_of_day] || 4)
  })
}

/**
 * Returns the dates this habit should be completed on.
 * If duration_weeks is null (continuous), generates up to 1 year ahead of current date to cover all needs.
 */
export function getScheduledDates(habit: Habit): Date[] {
  const start = startOfDay(parseISO(habit.start_date))
  const daysPassed = differenceInDays(new Date(), start)
  const totalDays = habit.duration_weeks ? habit.duration_weeks * 7 : Math.max(daysPassed + 365, 365)
  
  const dates: Date[] = []

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(start, i)
    if (isScheduledOn(habit, date)) {
      dates.push(date)
    }
  }

  return dates
}

/**
 * Returns true if the habit is scheduled on the given date.
 */
export function isScheduledOn(habit: Habit, date: Date): boolean {
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  switch (habit.frequency_type) {
    case 'daily':
      return true
    case 'weekdays':
      return habit.frequency_days.includes(dayOfWeek)
    case 'weekly':
      // For weekly, we'll just check if today is included in chosen days
      return habit.frequency_days.includes(dayOfWeek)
    case 'monthly':
      return habit.frequency_days.includes(date.getDate())
    default:
      return true
  }
}

/**
 * Calculate streak for a habit given its completions.
 */
export function calculateStreak(
  habit: Habit,
  completions: HabitCompletion[]
): { currentStreak: number; bestStreak: number } {
  const completedDates = completions.filter(c => c.notes !== 'VACATION').map(c =>
    startOfDay(parseISO(c.completed_at as string))
  )
  const vacationDates = completions.filter(c => c.notes === 'VACATION').map(c =>
    startOfDay(parseISO(c.completed_at as string))
  )

  const scheduledDates = getScheduledDates(habit)
    .filter(d => d <= startOfDay(new Date()))
    .sort((a, b) => b.getTime() - a.getTime()) // newest first

  let currentStreak = 0
  let bestStreak = 0
  let tempStreak = 0
  let inCurrentStreak = true

  for (let i = 0; i < scheduledDates.length; i++) {
    const scheduledDate = scheduledDates[i]
    const wasCompleted = completedDates.some(d => isSameDay(d, scheduledDate))
    const wasVacation = vacationDates.some(d => isSameDay(d, scheduledDate))

    if (wasCompleted) {
      tempStreak++
      if (inCurrentStreak) currentStreak++
      if (tempStreak > bestStreak) bestStreak = tempStreak
    } else if (wasVacation) {
      // Paused: do nothing to tempStreak or currentStreak, just skip to next day
    } else {
      // Allow today to not break the streak
      if (i === 0 && isSameDay(scheduledDate, new Date())) continue
      inCurrentStreak = false
      tempStreak = 0
    }
  }

  return { currentStreak, bestStreak }
}

/**
 * Calculate completion percentage for a habit.
 */
export function calculateCompletionRate(
  habit: Habit,
  completions: HabitCompletion[]
): number {
  const scheduledDates = getScheduledDates(habit)
    .filter(d => d <= startOfDay(new Date()))
  
  if (scheduledDates.length === 0) return 0

  const completedDates = completions.filter(c => c.notes !== 'VACATION').map(c =>
    startOfDay(parseISO(c.completed_at as string))
  )
  const vacationDates = completions.filter(c => c.notes === 'VACATION').map(c =>
    startOfDay(parseISO(c.completed_at as string))
  )

  const activeDates = scheduledDates.filter(d => !vacationDates.some(vd => isSameDay(vd, d)))
  if (activeDates.length === 0) return 0

  const completedCount = activeDates.filter(d =>
    completedDates.some(cd => isSameDay(cd, d))
  ).length

  return Math.round((completedCount / activeDates.length) * 100)
}

/**
 * Returns true if the habit was completed on the given date (excluding vacations).
 */
export function wasCompletedOn(completions: HabitCompletion[], date: Date): boolean {
  return completions.some(c => c.notes !== 'VACATION' && isSameDay(startOfDay(parseISO(c.completed_at as string)), startOfDay(date)))
}

/**
 * Returns true if the habit was on vacation on the given date.
 */
export function wasVacationOn(completions: HabitCompletion[], date: Date): boolean {
  return completions.some(c => c.notes === 'VACATION' && isSameDay(startOfDay(parseISO(c.completed_at as string)), startOfDay(date)))
}

/**
 * Returns weeks array for the progress grid.
 * If duration is null, shows up to the current week + 4 future weeks.
 */
export function getProgressGrid(habit: Habit, completions: HabitCompletion[]): {
  week: number
  days: { date: Date; scheduled: boolean; completed: boolean; vacation: boolean }[]
}[] {
  const start = startOfDay(parseISO(habit.start_date))
  const daysPassed = differenceInDays(new Date(), start)
  
  // If continuous, show elapsed weeks + 4 extra weeks, minimum 12 weeks
  const totalWeeks = habit.duration_weeks || Math.max(12, Math.ceil(daysPassed / 7) + 4)
  
  const completedDates = completions.filter(c => c.notes !== 'VACATION').map(c =>
    startOfDay(parseISO(c.completed_at as string))
  )
  const vacationDates = completions.filter(c => c.notes === 'VACATION').map(c =>
    startOfDay(parseISO(c.completed_at as string))
  )

  const weeks = []
  for (let w = 0; w < totalWeeks; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d)
      const scheduled = isScheduledOn(habit, date)
      const completed = completedDates.some(cd => isSameDay(cd, date))
      const vacation = vacationDates.some(vd => isSameDay(vd, date))
      days.push({ date, scheduled, completed, vacation })
    }
    weeks.push({ week: w + 1, days })
  }
  return weeks
}

/**
 * Format date in pt-BR
 */
export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: ptBR })
}

/**
 * Get days until end of habit
 * Returns null if infinite
 */
export function daysUntilEnd(habit: Habit): number | null {
  if (!habit.duration_weeks) return null
  const end = addDays(parseISO(habit.start_date), habit.duration_weeks * 7)
  return Math.max(0, differenceInDays(end, new Date()))
}
