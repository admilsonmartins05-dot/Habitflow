'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import {
  BarChart2,
  Calendar as CalendarIcon,
  Home,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  X,
  Bot,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/estatisticas', label: 'Estatísticas', icon: BarChart2 },
  { href: '/calendario', label: 'Calendário', icon: CalendarIcon },
  { href: '/assistente', label: 'Assistente', icon: Bot },
  { href: '/perfil', label: 'Perfil', icon: User },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dark, setDark] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const isDark = localStorage.getItem('habitflow-theme') === 'dark' ||
      (!localStorage.getItem('habitflow-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setDark(isDark)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(async ({ data }) => { 
          if (data) {
            setProfile(data)
          } else {
            const { data: newProfile } = await supabase.from('profiles').insert({
              id: user.id,
              username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
              avatar_url: user.user_metadata?.avatar_url || null,
            }).select().single()
            if (newProfile) setProfile(newProfile)
          }
        })
    })
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('habitflow-theme', next ? 'dark' : 'light')
    supabase.from('profiles').update({ dark_mode: next }).eq('id', profile?.id || '')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>HabitFlow</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>rastreador de hábitos</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 12px', flex: 1, overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${pathname.startsWith(href) ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--bg-primary)', marginBottom: 8,
          }}>
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                : profile.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                ⭐ {profile.total_points} pts · {profile.level}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, fontSize: 13 }}
            onClick={toggleDark}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? 'Claro' : 'Escuro'}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={handleLogout}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>HabitFlow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon" onClick={toggleDark}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            style={{
              width: 280, height: '100%',
              background: 'var(--bg-secondary)',
              display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content" style={{ paddingTop: 60 }}>
        <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      {/* Bottom Nav (Mobile - Floating Dock) */}
      <nav className="bottom-nav lg:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={22} className="icon" />
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                {label.split(' ')[0]}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
