import { createClient } from '@/lib/supabase/client'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  htmlLink: string
}

export async function getGoogleCalendarEvents(startDate?: Date, endDate?: Date): Promise<{ events: CalendarEvent[], error: string | null, needsAuth: boolean }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return { events: [], error: 'Not authenticated', needsAuth: true }
  }

  const providerToken = session.provider_token
  
  if (!providerToken) {
    return { events: [], error: 'No Google Calendar token', needsAuth: true }
  }

  try {
    const defaultStart = new Date()
    defaultStart.setHours(0, 0, 0, 0)
    
    const defaultEnd = new Date(defaultStart)
    defaultEnd.setDate(defaultEnd.getDate() + 7)
    defaultEnd.setHours(23, 59, 59, 999)

    const finalStart = startDate || defaultStart
    const finalEnd = endDate || defaultEnd

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${finalStart.toISOString()}&timeMax=${finalEnd.toISOString()}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { events: [], error: 'Token expired', needsAuth: true }
      }
      return { events: [], error: 'Failed to fetch events', needsAuth: false }
    }

    const data = await response.json()
    
    const events: CalendarEvent[] = (data.items || []).map((item: any) => {
      const start = item.start.dateTime || item.start.date
      const end = item.end.dateTime || item.end.date
      return {
        id: item.id,
        title: item.summary,
        start: new Date(start),
        end: new Date(end),
        htmlLink: item.htmlLink,
      }
    })

    return { events, error: null, needsAuth: false }
  } catch (err: any) {
    return { events: [], error: err.message, needsAuth: false }
  }
}
