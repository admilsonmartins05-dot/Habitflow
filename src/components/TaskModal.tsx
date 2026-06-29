import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, AlignLeft, RefreshCw, Trash2, Check } from 'lucide-react'
import type { Task } from '@/lib/types'
import { format } from 'date-fns'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (task: Partial<Task>) => Promise<void>
  onDelete?: (taskId: string) => Promise<void>
  task?: Task | null
}

const REPETITION_OPTIONS = [
  { value: 'none', label: 'Não repetir' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensalmente' },
]

export function TaskModal({ isOpen, onClose, onSave, onDelete, task }: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title)
        setDescription(task.description || '')
        setDueDate(task.due_date || '')
        setDueTime(task.due_time || '')
        setRecurrence(task.recurrence || 'none')
      } else {
        setTitle('')
        setDescription('')
        setDueDate(format(new Date(), 'yyyy-MM-dd'))
        setDueTime('')
        setRecurrence('none')
      }
    }
  }, [isOpen, task])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      recurrence,
    })
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!task || !onDelete) return
    if (!confirm('Excluir esta tarefa?')) return

    setDeleting(true)
    await onDelete(task.id)
    setDeleting(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
              zIndex: 9998,
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '90%', maxWidth: 440,
              background: 'var(--bg-card)', borderRadius: 24,
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              zIndex: 9999, overflow: 'hidden', border: '1px solid var(--border)',
            }}
          >
            <form onSubmit={handleSave}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px', borderBottom: '1px solid var(--border)'
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {task ? 'Editar Tarefa' : 'Nova Tarefa'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4, display: 'flex'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Title */}
                <div>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="O que você precisa fazer?"
                    autoFocus
                    style={{
                      width: '100%', fontSize: 20, fontWeight: 700, border: 'none',
                      background: 'transparent', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>

                {/* Description */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <AlignLeft size={18} color="var(--text-muted)" style={{ marginTop: 12 }} />
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Adicionar descrição..."
                    rows={2}
                    style={{
                      width: '100%', fontSize: 14, border: 'none', background: 'transparent',
                      color: 'var(--text-secondary)', resize: 'none', outline: 'none',
                      padding: '12px 0'
                    }}
                  />
                </div>

                {/* Date & Time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 12 }}>
                    <Calendar size={18} color="var(--text-muted)" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', flex: 1, fontSize: 14 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 12 }}>
                    <Clock size={18} color="var(--text-muted)" />
                    <input
                      type="time"
                      value={dueTime}
                      onChange={e => setDueTime(e.target.value)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', flex: 1, fontSize: 14 }}
                    />
                  </div>
                </div>

                {/* Recurrence */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 12 }}>
                  <RefreshCw size={18} color="var(--text-muted)" />
                  <select
                    value={recurrence}
                    onChange={e => setRecurrence(e.target.value as any)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', flex: 1, fontSize: 14 }}
                  >
                    {REPETITION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div style={{
                padding: '16px 24px', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-input)'
              }}>
                {task && onDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    style={{
                      background: 'none', border: 'none', color: '#ef4444',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 14, fontWeight: 600, padding: '8px 12px', borderRadius: 8,
                    }}
                  >
                    <Trash2 size={16} /> Excluir
                  </button>
                ) : <div />}
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || deleting || !title.trim()}
                    style={{ padding: '8px 16px' }}
                  >
                    <Check size={16} />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
