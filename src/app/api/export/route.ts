import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'csv'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: habits }, { data: completions }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', user.id),
    supabase.from('habit_completions').select('*').eq('user_id', user.id).order('completed_at'),
  ])

  if (type === 'csv') {
    const rows = [
      ['Data', 'Hábito', 'Emoji', 'Horário'].join(','),
      ...(completions || []).map((c: any) => {
        const habit = (habits || []).find((h: any) => h.id === c.habit_id)
        const date = format(parseISO(c.completed_at), 'dd/MM/yyyy', { locale: ptBR })
        const time = format(parseISO(c.completed_at), 'HH:mm', { locale: ptBR })
        return [date, habit?.name || '', habit?.emoji || '', time].join(',')
      }),
    ].join('\n')

    return new NextResponse(rows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="habitflow-export.csv"',
      },
    })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
