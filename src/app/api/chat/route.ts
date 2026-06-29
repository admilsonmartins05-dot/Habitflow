import { createClient } from '@/lib/supabase/server'
import { google } from '@ai-sdk/google'
import { streamText, tool, zodSchema } from 'ai'
import { z } from 'zod'
import { cookies } from 'next/headers'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API_KEY_MISSING' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()

    const today = new Date().toISOString().split('T')[0]

    const result = streamText({
      model: google('gemini-1.5-pro'),
      messages,
      system: `Você é o Assistente Virtual do HabitFlow. Hoje é ${today}.
Você é proativo, amigável e atua como um assistente pessoal de produtividade.
Você pode criar tarefas, consultar a agenda (eventos do Google Calendar) e sugerir hábitos.
Se o usuário mencionar algo que precisa fazer (ex: ligar pra mãe, reunião amanhã), use a ferramenta createTask.
Se o usuário perguntar sobre compromissos ou agenda, use getCalendarEvents.
Se o usuário reclamar de uma dificuldade ou querer criar um hábito, use createHabit.
Responda sempre em português brasileiro. Seja conciso e direto.`,
      tools: {
        createTask: tool({
          description: 'Cria uma nova tarefa para o usuário no sistema.',
          parameters: z.object({
            title: z.string().describe('O título ou descrição da tarefa'),
            due_date: z.string().describe('Data da tarefa no formato YYYY-MM-DD'),
            due_time: z.string().optional().describe('Horário opcional no formato HH:MM'),
          }),
          execute: async ({ title, due_date, due_time }: any) => {
            if (!user) return { error: 'Usuário não autenticado' }
            const { data, error } = await supabase.from('tasks').insert({
              user_id: user.id,
              title,
              due_date,
              due_time: due_time || null,
              completed: false,
            }).select().single()
            if (error) return { error: error.message }
            return { success: true, task: { id: data.id, title: data.title, due_date: data.due_date } }
          },
        } as any),

        createHabit: tool({
          description: 'Cria um novo hábito no sistema para o usuário.',
          parameters: z.object({
            name: z.string().describe('Nome do hábito (curto e direto)'),
            emoji: z.string().describe('Um único emoji que representa o hábito'),
          }),
          execute: async ({ name, emoji }: any) => {
            if (!user) return { error: 'Usuário não autenticado' }
            const { data, error } = await supabase.from('habits').insert({
              user_id: user.id,
              name,
              emoji,
              color: '#3b82f6',
              frequency_type: 'daily',
              frequency_days: [0, 1, 2, 3, 4, 5, 6],
            }).select().single()
            if (error) return { error: error.message }
            return { success: true, habit: { id: data.id, name: data.name } }
          },
        } as any),

        getCalendarEvents: tool({
          description: 'Busca os compromissos e eventos na agenda do Google Calendar do usuário.',
          parameters: z.object({
            startDate: z.string().describe('Data inicial no formato YYYY-MM-DD'),
            endDate: z.string().describe('Data final no formato YYYY-MM-DD'),
          }),
          execute: async ({ startDate, endDate }: any) => {
            if (!session?.provider_token) {
              return { events: [], message: 'Sem acesso ao Google Calendar nesta sessão. Tente sair e entrar novamente com sua conta Google.' }
            }
            try {
              const start = new Date(startDate + 'T00:00:00').toISOString()
              const end = new Date(endDate + 'T23:59:59').toISOString()
              const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=50`,
                { headers: { Authorization: `Bearer ${session.provider_token}` } }
              )
              if (!response.ok) return { events: [], error: 'Falha ao conectar com o Google Calendar' }
              const data = await response.json()
              const events = (data.items || []).map((item: any) => ({
                title: item.summary || 'Sem título',
                start: item.start?.dateTime || item.start?.date,
                end: item.end?.dateTime || item.end?.date,
                description: item.description || null,
              }))
              return { success: true, events, total: events.length }
            } catch {
              return { events: [], error: 'Erro ao buscar eventos.' }
            }
          },
        } as any),
      },
    })

    return result.toTextStreamResponse()
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
