'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Clock, Loader2 } from 'lucide-react'
import type { FrequencyType, TimeOfDay } from '@/lib/types'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#22c55e', '#10b981',
  '#0ea5e9', '#3b82f6', '#64748b', '#1a1a2e',
]

const EMOJIS = [
  '⭐','💧','🏋️','🧘','📚','😴','✍️','💊','🚴','🎯','💡','🌱',
  '🍎','🏃','🧠','💪','🎵','🎨','📝','🔥','⚡','🌙','☀️','❤️',
  '🦁','🐝','🦋','🌸','🏔️','🌊','🍵','☕','🥗','🥦','💻','📱',
  '🎮','📸','✈️','🏠','💰','🤝','🙏','🌟','⚽','🎸',
]

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Diariamente', desc: 'Todos os dias', icon: '📅' },
  { value: 'weekdays', label: 'Dias específicos', desc: 'Escolha os dias da semana', icon: '📆' },
  { value: 'weekly', label: 'X vezes por semana', desc: 'Meta semanal flexível', icon: '🗓️' },
  { value: 'monthly', label: 'Mensal', desc: 'Dias específicos do mês', icon: '📋' },
]

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STEPS = ['Nome', 'Frequência', 'Duração', 'Estilo', 'Horário']

const PERIOD_OPTIONS: { value: TimeOfDay, label: string, icon: string }[] = [
  { value: 'morning', label: 'Matinal', icon: '🌅' },
  { value: 'afternoon', label: 'Diurno', icon: '☀️' },
  { value: 'night', label: 'Noturno', icon: '🌙' },
  { value: 'anytime', label: 'Qualquer horário', icon: '🕒' },
]

export default function NovoHabitoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('⭐')
  const [color, setColor] = useState('#6366f1')
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily')
  const [frequencyDays, setFrequencyDays] = useState<number[]>([])
  const [timesPerWeek, setTimesPerWeek] = useState(3)
  const [durationWeeks, setDurationWeeks] = useState<number | null>(12)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('anytime')
  const [reminderTime, setReminderTime] = useState('')

  const toggleDay = (d: number) => {
    setFrequencyDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  const canNext = () => {
    if (step === 0) return name.trim().length >= 2
    if (step === 1 && frequencyType === 'weekdays') return frequencyDays.length > 0
    return true
  }

  const handleSubmit = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase.from('habits').insert({
      user_id: user.id,
      name: name.trim(),
      emoji,
      color,
      frequency_type: frequencyType,
      frequency_days: frequencyDays,
      frequency_times_per_week: timesPerWeek,
      duration_weeks: durationWeeks,
      time_of_day: timeOfDay,
      start_date: new Date().toISOString().split('T')[0],
      reminder_time: reminderTime || null,
    }).select().single()

    setLoading(false)
    if (!error && data) {
      router.push(`/habitos/${data.id}`)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Nome do hábito</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 28 }}>
              Como você quer chamar esse hábito?
            </p>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Nome</label>
              <input
                className="input"
                type="text"
                placeholder="Ex: Beber 2L de água"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Emoji (opcional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto',
                padding: '8px 0' }}>
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    style={{
                      width: 44, height: 44, borderRadius: 12, fontSize: 22,
                      border: `2px solid ${emoji === e ? color : 'var(--border)'}`,
                      background: emoji === e ? `${color}15` : 'var(--bg-input)',
                      boxShadow: emoji === e ? `0 4px 12px ${color}30` : 'none',
                      cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 1:
        return (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Frequência</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 28 }}>
              Com que frequência você quer realizar esse hábito?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {FREQ_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFrequencyType(opt.value as FrequencyType)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                    borderRadius: 16, border: `2px solid ${frequencyType === opt.value ? color : 'var(--border-dark)'}`,
                    background: frequencyType === opt.value ? `${color}10` : 'var(--bg-input)',
                    boxShadow: frequencyType === opt.value ? `0 4px 12px ${color}15` : '0 2px 4px rgba(0,0,0,0.02)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: frequencyType === opt.value ? color : 'var(--text-primary)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                  {frequencyType === opt.value && <Check size={20} color={color} />}
                </button>
              ))}
            </div>

            {frequencyType === 'weekdays' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="label">Selecione os dias</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      style={{
                        width: 48, height: 48, borderRadius: 12, fontWeight: 700, fontSize: 13,
                        border: `2px solid ${frequencyDays.includes(i) ? color : 'var(--border-dark)'}`,
                        background: frequencyDays.includes(i) ? color : 'var(--bg-input)',
                        color: frequencyDays.includes(i) ? 'white' : 'var(--text-secondary)',
                        boxShadow: frequencyDays.includes(i) ? `0 4px 12px ${color}40` : 'none',
                        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >{d}</button>
                  ))}
                </div>
              </motion.div>
            )}

            {frequencyType === 'weekly' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="label">Vezes por semana: <strong>{timesPerWeek}</strong></label>
                <input type="range" min={1} max={7} value={timesPerWeek}
                  onChange={e => setTimesPerWeek(Number(e.target.value))}
                  style={{ width: '100%', accentColor: color, height: 6, borderRadius: 3 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13,
                  color: 'var(--text-muted)', marginTop: 8 }}>
                  <span>1x</span><span>7x</span>
                </div>
              </motion.div>
            )}
          </div>
        )

      case 2:
        return (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Duração da meta</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 28 }}>
              Por quanto tempo quer manter esse hábito?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[4, 8, 12, 16, 26, 52].map(weeks => (
                <button
                  key={weeks}
                  onClick={() => setDurationWeeks(weeks)}
                  style={{
                    padding: '16px', borderRadius: 16, textAlign: 'center',
                    border: `2px solid ${durationWeeks === weeks ? color : 'var(--border-dark)'}`,
                    background: durationWeeks === weeks ? `${color}10` : 'var(--bg-input)',
                    boxShadow: durationWeeks === weeks ? `0 4px 12px ${color}15` : '0 2px 4px rgba(0,0,0,0.02)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <span style={{ fontSize: 28 }}>
                    {weeks <= 4 ? '🌱' : weeks <= 12 ? '🌳' : weeks <= 26 ? '🏔️' : '🌍'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: durationWeeks === weeks ? color : 'var(--text-primary)' }}>
                      {weeks === 4 ? '1 mês' : weeks === 8 ? '2 meses' : weeks === 12 ? '3 meses' :
                        weeks === 16 ? '4 meses' : weeks === 26 ? '6 meses' : '1 ano'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{weeks} semanas</div>
                  </div>
                </button>
              ))}
              
              {/* Opção sem prazo (Contínuo) */}
              <button
                onClick={() => setDurationWeeks(null)}
                style={{
                  gridColumn: '1 / -1',
                  padding: '16px 20px', borderRadius: 16, textAlign: 'left',
                  border: `2px solid ${durationWeeks === null ? color : 'var(--border-dark)'}`,
                  background: durationWeeks === null ? `${color}10` : 'var(--bg-input)',
                  boxShadow: durationWeeks === null ? `0 4px 12px ${color}15` : '0 2px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  marginTop: 4,
                }}
              >
                <span style={{ fontSize: 32 }}>♾️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: durationWeeks === null ? color : 'var(--text-primary)' }}>
                    Contínuo (Sem prazo)
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Para um estilo de vida permanente</div>
                </div>
                {durationWeeks === null && <Check size={20} color={color} />}
              </button>
            </div>
          </div>
        )

      case 3:
        return (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Personalização</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Escolha uma cor de destaque para seu hábito
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>

            {/* Preview */}
            <div style={{ marginTop: 16 }}>
              <label className="label">Prévia</label>
              <div className="card" style={{
                padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
                borderLeft: `4px solid ${color}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  border: `2.5px solid ${color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 18 }}>{emoji}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{name || 'Meu hábito'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {frequencyType === 'daily' ? 'Todo dia' :
                      frequencyType === 'weekdays' ? `${frequencyDays.length} dias/semana` :
                      frequencyType === 'weekly' ? `${timesPerWeek}x/semana` : 'Mensal'}
                    {' · '}{durationWeeks ? `${durationWeeks} semanas` : 'Sem prazo'}
                    {' · '}{PERIOD_OPTIONS.find(p => p.value === timeOfDay)?.label}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Horário</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Em qual período e horário você quer realizar esse hábito?
            </p>

            <div style={{ marginBottom: 24 }}>
              <label className="label">Período do dia</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeOfDay(opt.value)}
                    style={{
                      padding: '14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                      border: `2px solid ${timeOfDay === opt.value ? color : 'var(--border)'}`,
                      background: timeOfDay === opt.value ? `${color}15` : 'var(--bg-card)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: timeOfDay === opt.value ? color : 'var(--text-primary)' }}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="label">Horário do lembrete (Opcional)</label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  className="input"
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  style={{ paddingLeft: 40, fontSize: 16 }}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="card" style={{ padding: 20, background: `${color}10`, border: `1.5px solid ${color}30` }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: color }}>
                Resumo do hábito
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Hábito', `${emoji} ${name}`],
                  ['Frequência', frequencyType === 'daily' ? 'Diariamente' :
                    frequencyType === 'weekdays' ? `${frequencyDays.length} dias/semana` :
                    frequencyType === 'weekly' ? `${timesPerWeek}x/semana` : 'Mensal'],
                  ['Duração', durationWeeks ? `${durationWeeks} semanas` : 'Contínuo / Sem prazo'],
                  ['Período', PERIOD_OPTIONS.find(p => p.value === timeOfDay)?.label || 'Qualquer horário'],
                  ['Lembrete', reminderTime || 'Sem lembrete'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Back */}
      <button className="btn btn-ghost" onClick={() => router.back()} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              height: 4, width: '100%', borderRadius: 2,
              background: i <= step ? color : 'var(--border)',
              transition: 'background 0.3s',
            }} />
            <span style={{ fontSize: 10, color: i === step ? color : 'var(--text-muted)', fontWeight: i === step ? 700 : 400 }}>
              {s}
            </span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '28px 24px', marginBottom: 20 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        {step > 0 && (
          <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: color, boxShadow: `0 4px 12px ${color}55` }}
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
          >
            Próximo <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: color, boxShadow: `0 4px 12px ${color}55` }}
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
          >
            {loading ? <Loader2 size={16} /> : <Check size={16} />}
            Criar hábito
          </button>
        )}
      </div>
    </div>
  )
}
