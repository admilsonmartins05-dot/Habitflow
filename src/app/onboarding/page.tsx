'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Loader2, Upload } from 'lucide-react'

const SLIDES = [
  {
    emoji: '⚡',
    title: 'Bem-vindo ao HabitFlow',
    description: 'Crie hábitos poderosos com rastreamento visual, streaks motivadores e conquistas desbloqueáveis.',
    color: '#6366f1',
    bg: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
    darkBg: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 100%)',
  },
  {
    emoji: '📊',
    title: 'Visualize seu progresso',
    description: 'Grade de checkboxes semanal, estatísticas detalhadas e comparativos — tudo em um lugar só.',
    color: '#0ea5e9',
    bg: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
    darkBg: 'linear-gradient(135deg, #0c4a6e 0%, #1e3a5f 100%)',
  },
  {
    emoji: '🏆',
    title: 'Ganhe pontos e badges',
    description: 'Cada hábito concluído vale pontos. Mantenha seu streak e desbloqueie conquistas exclusivas!',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    darkBg: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
  },
]

const POPULAR_HABITS = [
  { name: 'Beber água', emoji: '💧', color: '#0ea5e9', frequency_type: 'daily' },
  { name: 'Exercitar', emoji: '🏋️', color: '#22c55e', frequency_type: 'daily' },
  { name: 'Meditar', emoji: '🧘', color: '#8b5cf6', frequency_type: 'daily' },
  { name: 'Ler', emoji: '📚', color: '#f59e0b', frequency_type: 'daily' },
  { name: 'Dormir cedo', emoji: '😴', color: '#6366f1', frequency_type: 'daily' },
  { name: 'Diário', emoji: '✍️', color: '#ec4899', frequency_type: 'daily' },
  { name: 'Sem redes sociais', emoji: '🚫', color: '#ef4444', frequency_type: 'daily' },
  { name: 'Vitaminas', emoji: '💊', color: '#10b981', frequency_type: 'daily' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0) // 0,1,2 = slides; 3 = perfil; 4 = hábitos
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [selectedHabits, setSelectedHabits] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const toggleHabit = (i: number) => {
    const next = new Set(selectedHabits)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelectedHabits(next)
  }

  const [error, setError] = useState('')

  const handleFinish = async () => {
    setLoading(true)
    setError('')

    try {
      // Try to get the session first (works even if email not confirmed in some configs)
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()

      const currentUser = user || session?.user

      if (!currentUser) {
        // User not authenticated — redirect to login with message
        setLoading(false)
        setError('Sessão expirada. Faça login novamente.')
        setTimeout(() => router.push('/login'), 1500)
        return
      }

      // Upload avatar if provided
      let avatarUrl = ''
      if (avatarFile) {
        try {
          const ext = avatarFile.name.split('.').pop()
          const { data } = await supabase.storage.from('avatars')
            .upload(`${currentUser.id}.${ext}`, avatarFile, { upsert: true })
          if (data) {
            const { data: url } = supabase.storage.from('avatars').getPublicUrl(data.path)
            avatarUrl = url.publicUrl
          }
        } catch {
          // Avatar upload failed — continue without it
        }
      }

      // Update profile (ignore errors — profile trigger may have already created it)
      await supabase.from('profiles').upsert({
        id: currentUser.id,
        username: username || currentUser.email?.split('@')[0] || 'Usuário',
        avatar_url: avatarUrl || null,
        onboarding_completed: true,
      }).select()

      // Add selected popular habits
      const today = new Date().toISOString().split('T')[0]
      for (const i of selectedHabits) {
        const h = POPULAR_HABITS[i]
        try {
          await supabase.from('habits').insert({
            user_id: currentUser.id,
            name: h.name,
            emoji: h.emoji,
            color: h.color,
            frequency_type: h.frequency_type,
            frequency_days: [],
            duration_weeks: 12,
            start_date: today,
          })
        } catch {
          // Ignore individual habit insert errors
        }
      }
    } catch (err) {
      console.error('Onboarding error:', err)
      // Continue to dashboard even if there were errors
    }

    setLoading(false)
    router.push('/dashboard?tour=1')
  }


  // Slide view
  if (step <= 2) {
    const slide = SLIDES[step]
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        background: dark ? slide.darkBg : slide.bg,
        transition: 'background 0.5s ease',
      }}>
        {/* Progress dots */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i === step ? slide.color : 'rgba(0,0,0,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '40px 32px', textAlign: 'center',
            }}
          >
            <div style={{
              width: 120, height: 120,
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(12px)',
              borderRadius: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 56, marginBottom: 32,
              boxShadow: `0 8px 32px rgba(0,0,0,0.1)`,
            }}>
              {slide.emoji}
            </div>
            <h1 style={{
              fontSize: 30, fontWeight: 900, marginBottom: 16,
              color: dark ? '#f1f5f9' : '#0f172a', lineHeight: 1.2,
            }}>
              {slide.title}
            </h1>
            <p style={{
              fontSize: 17, color: dark ? '#94a3b8' : '#475569',
              maxWidth: 360, lineHeight: 1.6,
            }}>
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div style={{ padding: '0 32px 48px', display: 'flex', gap: 12 }}>
          {step > 0 && (
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setStep(s => s - 1)}
            >
              Voltar
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: slide.color, boxShadow: `0 4px 14px ${slide.color}55` }}
            onClick={() => setStep(s => s + 1)}
          >
            {step === 2 ? 'Começar' : 'Próximo'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Profile setup
  if (step === 3) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: 24,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ width: '100%', maxWidth: 440, padding: 40 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Seu perfil</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Como quer ser chamado?
            </p>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <div
              style={{
                width: 96, height: 96, borderRadius: '50%',
                background: avatarPreview ? 'none' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: 'white', cursor: 'pointer',
                border: '3px solid var(--border)', overflow: 'hidden',
                position: 'relative', marginBottom: 12,
              }}
              onClick={() => fileRef.current?.click()}
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (username?.[0]?.toUpperCase() || '😊')}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', height: 30,
              }}>
                <Upload size={14} color="white" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              Escolher foto
            </button>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label className="label">Seu nome</label>
            <input
              className="input"
              type="text"
              placeholder="Como quer ser chamado?"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ fontSize: 16 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Voltar</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => setStep(4)}
            >
              Próximo
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Step 4: Popular habits
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg-primary)',
      padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 500 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
            Hábitos populares
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Selecione os que quer começar a rastrear (você pode adicionar mais depois)
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
          {POPULAR_HABITS.map((h, i) => {
            const selected = selectedHabits.has(i)
            return (
              <button
                key={i}
                onClick={() => toggleHabit(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: selected ? `${h.color}18` : 'var(--bg-card)',
                  border: `2px solid ${selected ? h.color : 'var(--border)'}`,
                  borderRadius: 12, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>{h.emoji}</span>
                <span style={{
                  fontWeight: 600, fontSize: 14,
                  color: selected ? h.color : 'var(--text-primary)',
                  flex: 1,
                }}>{h.name}</span>
                {selected && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: h.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={12} color="white" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setStep(3)}>Voltar</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleFinish}
            disabled={loading}
          >
            {loading
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
              : selectedHabits.size > 0
              ? `Adicionar ${selectedHabits.size} hábito${selectedHabits.size > 1 ? 's' : ''} →`
              : 'Pular →'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 500,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </motion.div>
    </div>
  )
}
