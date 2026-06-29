'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nome } },
    })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Immediately sign in to ensure session is active (handles email confirm disabled configs)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      // Sign-up worked but sign-in failed (likely email confirmation required)
      // Show success and let them manually log in
      setSuccess(true)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/onboarding'), 800)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="card" style={{ maxWidth: 420, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Conta criada!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Se você não for redirecionado em instantes, por favor, verifique a caixa de entrada do seu E-mail para confirmar a conta!
          </p>
          <Link href="/login" className="btn btn-secondary" style={{ marginTop: 24, width: '100%' }}>
            Ir para o Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
          }}>⚡</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Criar conta
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Comece sua jornada de hábitos hoje
          </p>
        </div>

        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginBottom: 20, fontSize: 14 }}
          onClick={handleGoogle}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Registrar com Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="divider" style={{ margin: 0, flex: 1 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>ou</span>
          <div className="divider" style={{ margin: 0, flex: 1 }} />
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Seu nome</label>
            <input className="input" type="text" placeholder="João Silva" value={nome}
              onChange={e => setNome(e.target.value)} required />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" placeholder="seu@email.com" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Senha</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6}
                style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 500 }}>{error}</div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? <Loader2 size={18} /> : null}
            Criar conta grátis
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          Já tem conta?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Entrar</Link>
        </p>
      </div>
    </div>
  )
}
