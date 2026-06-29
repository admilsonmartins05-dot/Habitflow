'use client'

import { useChat } from '@ai-sdk/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, Loader2, KeyRound, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, KeyboardEvent } from 'react'

export default function AssistentePage() {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, append, isLoading, error } = useChat({
    api: '/api/chat',
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return
    setInputValue('')
    await append({ role: 'user', content: text })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isMissingKey = !!(error && (
    error.message?.includes('API_KEY_MISSING') ||
    error.message?.includes('sua_chave_aqui')
  ))

  const suggestions = [
    'Crie uma tarefa para eu ligar para minha mãe amanhã',
    'O que tenho programado essa semana?',
    'Me ajude a criar um hábito de meditação',
  ]

  return (
    <div style={{
      maxWidth: 680,
      margin: '0 auto',
      height: 'calc(100dvh - 140px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 18,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
        }}>
          <Bot size={26} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Assistente IA
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Seu secretário pessoal inteligente
          </p>
        </div>

        {isLoading && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            <Loader2 size={14} className="animate-spin" />
            Pensando...
          </div>
        )}
      </div>

      {isMissingKey ? (
        <div className="card" style={{
          padding: 32, textAlign: 'center', flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #ef4444',
        }}>
          <KeyRound size={48} color="#ef4444" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>
            Chave de API Necessária
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.6 }}>
            Abra o arquivo <code>.env.local</code> e substitua{' '}
            <strong>sua_chave_aqui</strong> pela sua chave do Google Gemini.
            Obtenha grátis em{' '}
            <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
              style={{ color: '#3b82f6' }}>aistudio.google.com</a>.
          </p>
        </div>
      ) : (
        <div className="card" style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', padding: 0,
        }}>
          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '20px 20px 8px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center', color: 'var(--text-muted)',
                margin: 'auto', paddingBottom: 20,
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 24, margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={32} opacity={0.4} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Olá! Como posso ajudar?
                </p>
                <p style={{ fontSize: 13, marginBottom: 20 }}>
                  Tente uma dessas sugestões:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380, margin: '0 auto' }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setInputValue(s); inputRef.current?.focus() }}
                      style={{
                        padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--bg-input)',
                        color: 'var(--text-secondary)', fontSize: 13, textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            <AnimatePresence>
              {messages.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                    gap: 10, alignItems: 'flex-end',
                  }}
                >
                  {m.role !== 'user' && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', flexShrink: 0,
                    }}>
                      <Bot size={15} />
                    </div>
                  )}

                  <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Tool invocations */}
                    {m.toolInvocations && m.toolInvocations.map(inv => (
                      <div key={inv.toolCallId} style={{
                        padding: '8px 14px', borderRadius: 12,
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        fontSize: 12, color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {inv.state !== 'result'
                          ? <Loader2 size={12} className="animate-spin" />
                          : <span>✓</span>
                        }
                        {inv.toolName === 'createTask' && (inv.state === 'result' ? 'Tarefa criada!' : 'Criando tarefa...')}
                        {inv.toolName === 'createHabit' && (inv.state === 'result' ? 'Hábito criado!' : 'Criando hábito...')}
                        {inv.toolName === 'getCalendarEvents' && (inv.state === 'result' ? 'Agenda consultada!' : 'Consultando agenda...')}
                      </div>
                    ))}

                    {/* Text content */}
                    {m.content && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-input)',
                        color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                        fontSize: 14, lineHeight: 1.55,
                        boxShadow: m.role === 'user' ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {m.content}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', flexShrink: 0,
                }}>
                  <Bot size={15} />
                </div>
                <div style={{
                  padding: '10px 16px', borderRadius: '18px 18px 18px 4px',
                  background: 'var(--bg-input)', display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--text-muted)',
                      animation: `bounce 1.2s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Error display */}
            {error && !isMissingKey && (
              <div style={{
                padding: '10px 14px', borderRadius: 12, fontSize: 13,
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                ⚠️ Erro: {error.message}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
          }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Fale com seu assistente... (Enter para enviar)"
                disabled={isLoading}
                style={{
                  width: '100%', padding: '13px 52px 13px 18px', borderRadius: 24,
                  border: '1.5px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', outline: 'none', fontSize: 14,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                style={{
                  position: 'absolute', right: 8,
                  width: 38, height: 38, borderRadius: '50%',
                  background: inputValue.trim() && !isLoading ? 'var(--accent)' : 'transparent',
                  color: inputValue.trim() && !isLoading ? 'white' : 'var(--text-muted)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                <Send size={16} style={{ marginLeft: 2 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
