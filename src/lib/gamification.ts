import { createClient } from '@/lib/supabase/client'
import type { Badge, Habit, HabitCompletion, Profile, UserBadge } from './types'
import { LEVEL_ORDER, LEVEL_THRESHOLDS } from './types'
import { calculateStreak, isScheduledOn } from './habits'
import { isSameDay, parseISO, startOfDay, subDays } from 'date-fns'

// Points config
export const POINTS = {
  HABIT_COMPLETE: 10,
  TASK_COMPLETE: 5,
  DAILY_PERFECT: 30,
  STREAK_7: 50,
  STREAK_30: 200,
  STREAK_100: 500,
}

export function getLevel(points: number): string {
  let level = 'Iniciante'
  for (const l of LEVEL_ORDER) {
    if (points >= LEVEL_THRESHOLDS[l]) level = l
  }
  return level
}

export function getNextLevel(level: string): { name: string; threshold: number } | null {
  const idx = LEVEL_ORDER.indexOf(level as any)
  if (idx === -1 || idx === LEVEL_ORDER.length - 1) return null
  const next = LEVEL_ORDER[idx + 1]
  return { name: next, threshold: LEVEL_THRESHOLDS[next] }
}

export function getLevelProgress(points: number): number {
  const level = getLevel(points)
  const idx = LEVEL_ORDER.indexOf(level as any)
  const currentThreshold = LEVEL_THRESHOLDS[LEVEL_ORDER[idx]]
  const nextLevel = getNextLevel(level)
  if (!nextLevel) return 100
  const range = nextLevel.threshold - currentThreshold
  const progress = points - currentThreshold
  return Math.min(100, Math.round((progress / range) * 100))
}

/**
 * Award points and check badges after a habit completion.
 */
export async function processCompletion(
  habit: Habit,
  completions: HabitCompletion[],
  allHabitsToday: { habit: Habit; completions: HabitCompletion[] }[],
  profile: Profile
) {
  const supabase = createClient()
  const userId = habit.user_id
  let totalPoints = 0
  const reasons: string[] = []

  // Base points
  totalPoints += POINTS.HABIT_COMPLETE
  reasons.push(`Hábito "${habit.name}" concluído`)

  // Check streak milestones (only once per habit)
  const { data: pastTransactions } = await supabase.from('point_transactions')
    .select('reason')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    
  const pastReasons = (pastTransactions || []).map(t => t.reason).join(' | ')

  const { currentStreak, bestStreak } = calculateStreak(habit, completions)
  const highestStreak = Math.max(currentStreak, bestStreak)
  
  if (currentStreak === 7 && !pastReasons.includes('Streak de 7 dias')) {
    totalPoints += POINTS.STREAK_7
    reasons.push('Streak de 7 dias!')
  }
  if (currentStreak === 30 && !pastReasons.includes('Streak de 30 dias')) {
    totalPoints += POINTS.STREAK_30
    reasons.push('Streak de 30 dias!')
  }
  if (currentStreak === 100 && !pastReasons.includes('Streak de 100 dias')) {
    totalPoints += POINTS.STREAK_100
    reasons.push('Streak de 100 dias!')
  }

  // Check if all habits done today
  const today = startOfDay(new Date())
  const allDoneToday = allHabitsToday.every(({ habit: h, completions: cs }) => {
    if (!isScheduledOn(h, today)) return true
    return cs.some(c => isSameDay(startOfDay(parseISO(c.completed_at)), today))
  })

  if (allDoneToday && allHabitsToday.length > 0) {
    totalPoints += POINTS.DAILY_PERFECT
    reasons.push('Dia perfeito!')
  }

  // Insert point transaction
  await supabase.from('point_transactions').insert({
    user_id: userId,
    amount: totalPoints,
    reason: reasons.join(' + '),
    habit_id: habit.id,
  })

  // Update profile total_points
  const newTotal = profile.total_points + totalPoints
  const newLevel = getLevel(newTotal)
  await supabase.from('profiles').update({
    total_points: newTotal,
    level: newLevel,
  }).eq('id', userId)

  // Check and award badges
  await checkAndAwardBadges(userId, habit, completions, allHabitsToday, newTotal)

  return { pointsAwarded: totalPoints, reasons }
}

/**
 * Award points for completing a task.
 */
export async function processTaskCompletion(
  taskId: string,
  taskTitle: string,
  profile: Profile
) {
  const supabase = createClient()
  const totalPoints = POINTS.TASK_COMPLETE

  await supabase.from('point_transactions').insert({
    user_id: profile.id,
    amount: totalPoints,
    reason: `Tarefa "${taskTitle}" concluída`,
  })

  const newTotal = profile.total_points + totalPoints
  const newLevel = getLevel(newTotal)
  await supabase.from('profiles').update({
    total_points: newTotal,
    level: newLevel,
  }).eq('id', profile.id)

  return { pointsAwarded: totalPoints }
}

async function checkAndAwardBadges(
  userId: string,
  habit: Habit,
  completions: HabitCompletion[],
  allHabitsToday: { habit: Habit; completions: HabitCompletion[] }[],
  totalPoints: number
) {
  const supabase = createClient()

  const [{ data: badges }, { data: userBadges }] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ])

  if (!badges) return

  const earnedBadgeIds = new Set((userBadges || []).map((ub: any) => ub.badge_id))
  const { currentStreak, bestStreak } = calculateStreak(habit, completions)
  const highestStreak = Math.max(currentStreak, bestStreak)

  for (const badge of badges as Badge[]) {
    if (earnedBadgeIds.has(badge.id)) continue

    let earned = false

    switch (badge.slug) {
      case 'primeira_semana':
        earned = highestStreak >= 7
        break
      case 'mes_perfeito':
        earned = highestStreak >= 30
        break
      case 'inabalavel':
        earned = highestStreak >= 100
        break
      case 'consistente':
        // 3 active habits for 2 weeks
        earned = allHabitsToday.length >= 3
        break
      case 'dia_perfeito':
        // All habits done today
        {
          const today = startOfDay(new Date())
          earned = allHabitsToday.length > 0 && allHabitsToday.every(({ habit: h, completions: cs }) => {
            if (!isScheduledOn(h, today)) return true
            return cs.some(c => isSameDay(startOfDay(parseISO(c.completed_at)), today))
          })
        }
        break
    }

    if (earned) {
      try {
        await supabase.from('user_badges').insert({
          user_id: userId,
          badge_id: badge.id,
        })
      } catch { /* ignore duplicate */ }
    }
  }
}

export const BADGE_PROGRESS = {
  primeira_semana: (streak: number) => Math.min(100, Math.round((streak / 7) * 100)),
  mes_perfeito: (streak: number) => Math.min(100, Math.round((streak / 30) * 100)),
  inabalavel: (streak: number) => Math.min(100, Math.round((streak / 100) * 100)),
  consistente: (activeHabits: number) => Math.min(100, Math.round((activeHabits / 3) * 100)),
  dia_perfeito: (allDone: boolean) => allDone ? 100 : 0,
}
