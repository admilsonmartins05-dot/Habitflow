'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Camera, LogOut, ChevronRight, Download, FileText, Sun, Moon } from 'lucide-react'
import type { Profile, Badge } from '@/lib/types'
import { LEVEL_ORDER, LEVEL_THRESHOLDS } from '@/lib/types'
import { getLevel, getLevelProgress, getNextLevel } from '@/lib/gamification'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ALL_BADGES = [
  { id: '', slug: 'primeira_semana', name: 'Primeira semana', description: '7 dias seguidos em qualquer hábito', emoji: '🔥', total: 7 },
  { id: '', slug: 'mes_perfeito', name: 'Mês perfeito', description: '30 dias seguidos em qualquer hábito', emoji: '💪', total: 30 },
  { id: '', slug: 'consistente', name: 'Consistente', description: '3 hábitos ativos simultaneamente', emoji: '⚡', total: 3 },
  { id: '', slug: 'inabalavel', name: 'Inabalável', description: 'Streak de 100 dias', emoji: '🏆', total: 100 },
  { id: '', slug: 'dia_perfeito', name: 'Dia perfeito', description: 'Todos os hábitos do dia concluídos por 7 dias seguidos', emoji: '🌟', total: 7 },
]

export default function PerfilPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userBadges, setUserBadges] = useState<Set<string>>(new Set())
  const [dark, setDark] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Name edit states
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')

  // Vacation Mode states
  const [vacationStart, setVacationStart] = useState('')
  const [vacationEnd, setVacationEnd] = useState('')
  const [isVacationLoading, setIsVacationLoading] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, { data: ub }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_badges').select('*, badge:badges(slug, name)').eq('user_id', user.id),
      ])
      if (p) {
        setProfile(p)
      } else {
        // Auto-create if missing
        const { data: newProfile } = await supabase.from('profiles').insert({
          id: user.id,
          username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
          avatar_url: user.user_metadata?.avatar_url || null,
        }).select().single()
        if (newProfile) setProfile(newProfile)
      }
      if (ub) {
        const slugs = new Set<string>()
        ub.forEach((ub: any) => {
          if (ub.badge?.slug) slugs.add(ub.badge.slug)
        })
        setUserBadges(slugs)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('habitflow-theme', next ? 'dark' : 'light')
    if (profile) supabase.from('profiles').update({ dark_mode: next }).eq('id', profile.id)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSaveName = async () => {
    if (!tempName.trim() || !profile) {
      setIsEditingName(false)
      return
    }
    
    // Save locally immediately
    const updatedProfile = { ...profile, username: tempName.trim() }
    setProfile(updatedProfile)
    setIsEditingName(false)
    
    // Save to DB
    await supabase.from('profiles').update({ username: tempName.trim() }).eq('id', profile.id)
  }

  if (loading || !profile) {
    return <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 0' }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 12, borderRadius: 16 }} />)}
    </div>
  }

  const level = getLevel(profile.total_points)
  const nextLevel = getNextLevel(level)
  const progress = getLevelProgress(profile.total_points)
  const levelIdx = LEVEL_ORDER.indexOf(level as any)

  const handleAtivarFerias = async () => {
    if (!vacationStart || !vacationEnd) {
      alert('Selecione as datas de início e fim da sua viagem.')
      return
    }
    
    setIsVacationLoading(true)
    try {
      const { data: habits } = await supabase.from('habits').select('id, user_id').eq('user_id', profile.id).eq('archived', false)
      
      const start = new Date(vacationStart + 'T12:00:00')
      const end = new Date(vacationEnd + 'T12:00:00')
      
      if (end < start) {
        alert('A data de fim deve ser depois da data de início.')
        setIsVacationLoading(false)
        return
      }

      const daysToInsert = []
      const current = new Date(start)
      
      while (current <= end) {
        for (const h of (habits || [])) {
          daysToInsert.push({
            habit_id: h.id,
            user_id: h.user_id,
            completed_at: current.toISOString(),
            notes: 'VACATION'
          })
        }
        current.setDate(current.getDate() + 1)
      }
      
      if (daysToInsert.length > 0) {
        await supabase.from('habit_completions').insert(daysToInsert)
      }
      
      alert('🏖️ Modo Férias ativado com sucesso! O seu foguinho está congelado e seguro nesse período.')
      setVacationStart('')
      setVacationEnd('')
    } catch (e: any) {
      alert('Erro ao ativar modo férias: ' + e.message)
    } finally {
      setIsVacationLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 32 }}>
      {/* Profile Header Card */}
      <div className="card" style={{ padding: '32px 24px', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 16px' }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: profile.avatar_url ? 'none' : 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: 'white', overflow: 'hidden',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : profile.username?.[0]?.toUpperCase()}
          </div>
          {/* Camera Overlay */}
          <button style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 32, height: 32, borderRadius: '50%',
            background: '#6366f1', color: 'white',
            border: '3px solid var(--bg-card)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <Camera size={14} />
          </button>
        </div>
        
        {isEditingName ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              autoFocus
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              style={{
                fontSize: 22, fontWeight: 800, textAlign: 'center',
                background: 'var(--bg-input)', border: '2px solid var(--accent)',
                borderRadius: 8, padding: '4px 12px', outline: 'none', color: 'var(--text-primary)'
              }}
            />
          </div>
        ) : (
          <div onClick={() => { setTempName(profile.username); setIsEditingName(true) }} style={{ cursor: 'pointer' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              {profile.username}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Toque no nome para editar</p>
          </div>
        )}
      </div>

      {/* Points Card */}
      <div style={{
        background: level === 'Iniciante' ? 'linear-gradient(135deg, #22c55e, #10b981)' :
                    level === 'Consistente' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' :
                    level === 'Disciplinado' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                    'linear-gradient(135deg, #9333ea, #7e22ce)',
        borderRadius: 16, padding: '24px', color: 'white', marginBottom: 16,
        boxShadow: `0 8px 24px ${level === 'Iniciante' ? 'rgba(16, 185, 129, 0.25)' : level === 'Consistente' ? 'rgba(99, 102, 241, 0.25)' : level === 'Disciplinado' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(147, 51, 234, 0.25)'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.9, marginBottom: -4 }}>Pontos acumulados</div>
            <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 1 }}>{profile.total_points.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 4 }}>
              {level === 'Iniciante' ? '🌱' : level === 'Consistente' ? '⚡' : level === 'Disciplinado' ? '🎯' : '👑'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{level}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          <span>{level}</span>
          <span>{nextLevel?.name || 'Mestre Max'}</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ height: '100%', background: 'white', borderRadius: 3 }}
          />
        </div>
        {nextLevel && (
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>
            Faltam {nextLevel.threshold - profile.total_points} pts para {nextLevel.name}
          </div>
        )}
      </div>

      {/* Vacation Mode Card */}
      <div className="card" style={{ padding: '24px', marginBottom: 32, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: 'white', boxShadow: '0 8px 24px rgba(14, 165, 233, 0.25)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏖️</span> Modo Férias
        </h2>
        <p style={{ fontSize: 13, marginBottom: 20, opacity: 0.9, lineHeight: 1.4 }}>
          Vai viajar ou ficar doente? Congele temporariamente o seu progresso para não perder o seu foguinho (streak). Você não ganhará pontos nesses dias.
        </p>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.9 }}>Data de Início</label>
            <input type="date" value={vacationStart} onChange={e => setVacationStart(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', outline: 'none', fontSize: 14, fontWeight: 600 }}
              disabled={isVacationLoading}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.9 }}>Data Final</label>
            <input type="date" value={vacationEnd} onChange={e => setVacationEnd(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', outline: 'none', fontSize: 14, fontWeight: 600 }}
              disabled={isVacationLoading}
            />
          </div>
        </div>
        
        <button 
          onClick={handleAtivarFerias}
          disabled={isVacationLoading || !vacationStart || !vacationEnd}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'white', color: '#0284c7', fontSize: 15, fontWeight: 800,
            cursor: (isVacationLoading || !vacationStart || !vacationEnd) ? 'not-allowed' : 'pointer',
            opacity: (!vacationStart || !vacationEnd) ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isVacationLoading ? 'Ativando...' : 'Ativar Proteção de Ofensiva'}
        </button>
      </div>

      {/* Levels Timeline */}
      <div className="card" style={{ padding: '24px', marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: 'var(--text-primary)' }}>Níveis</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {LEVEL_ORDER.map((l, i) => {
            const isCurrent = level === l
            const isPassed = i < levelIdx
            // Map names to image/emoji placeholders exactly like the image (plant, lightning, target, crown)
            const iconMap: Record<string, string> = {
              Iniciante: '🌱', Consistente: '⚡', Disciplinado: '🎯', Mestre: '👑'
            }
            const colorMap: Record<string, string> = {
              Iniciante: '#22c55e', Consistente: '#6366f1', Disciplinado: '#f59e0b', Mestre: '#9333ea'
            }
            return (
              <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: isCurrent ? 'transparent' : 'var(--bg-input)',
                  border: isCurrent ? `2px solid ${colorMap[l]}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, marginBottom: 8,
                  position: 'relative', opacity: isPassed || isCurrent ? 1 : 0.4
                }}>
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', top: -4, right: -4, width: 12, height: 12,
                      background: '#6366f1', borderRadius: '50%', border: '2px solid var(--bg-card)'
                    }} />
                  )}
                  {iconMap[l]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent || isPassed ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {l}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {LEVEL_THRESHOLDS[l]}pts
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Achievements Grid */}
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Conquistas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
        {ALL_BADGES.map(badge => {
          const earned = userBadges.has(badge.slug)
          // Mocking progress visually as requested since real progress requires complex time-series queries
          const mockProgress = earned ? badge.total : Math.floor(badge.total * 0.4)
          const pct = Math.min(100, Math.round((mockProgress / badge.total) * 100))
          
          return (
            <div key={badge.slug} className="card" style={{ padding: '20px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 36, height: 36, margin: '0 auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                filter: earned ? 'none' : 'grayscale(1)', opacity: earned ? 1 : 0.4
              }}>
                {earned ? badge.emoji : '🔒'}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                {badge.name}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: 12, flex: 1 }}>
                {badge.description}
              </p>
              
              <div style={{ width: '100%' }}>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-input)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: earned ? '#22c55e' : '#8b5cf6', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {mockProgress}/{badge.total} {badge.slug.includes('dias') || badge.slug.includes('semana') || badge.slug.includes('mes') || badge.slug.includes('inabalavel') || badge.slug.includes('perfeito') ? 'dias' : 'hábitos'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Settings */}
      <div className="card" style={{ padding: '8px 0', marginBottom: 32 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Configurações</h2>
        </div>
        
        {/* Toggle Dark Mode */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer'
        }} onClick={toggleDark}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            <Sun size={20} color="var(--text-secondary)" />
            Modo escuro
          </div>
          {/* Custom Toggle Switch */}
          <div style={{
            width: 44, height: 24, borderRadius: 12, background: dark ? '#22c55e' : 'var(--border)',
            position: 'relative', transition: 'background 0.3s'
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 2, left: dark ? 22 : 2,
              transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        {/* CSV Export */}
        <a href="/api/export?type=csv" download="habitflow-export.csv" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            <Download size={20} color="var(--text-secondary)" />
            Exportar histórico (CSV)
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </a>

        {/* PDF Export Placeholder */}
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            <FileText size={20} color="var(--text-secondary)" />
            Exportar relatório (PDF)
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, fontSize: 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto'
        }}>
          <LogOut size={18} />
          Sair da conta
        </button>
      </div>
    </div>
  )
}
