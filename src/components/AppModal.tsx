import { useState, useEffect } from 'react'
import type { Application, ApplicationInput, Status } from '../types'

interface Props {
  app?: Application | null
  onSave: (data: ApplicationInput) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

export default function AppModal({ app, onSave, onDelete, onClose }: Props) {
  const [company, setCompany] = useState(app?.company ?? '')
  const [role, setRole] = useState(app?.role ?? '')
  const [status, setStatus] = useState<Status>(app?.status ?? 'applied')
  const [date, setDate] = useState(app?.date ?? new Date().toISOString().slice(0, 10))
  const [source, setSource] = useState(app?.source ?? '')
  const [notes, setNotes] = useState(app?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim() || !role.trim()) { setError('Company and role are required.'); return }
    setLoading(true)
    await onSave({ company: company.trim(), role: role.trim(), status, date, source: source.trim(), notes: notes.trim() })
    setLoading(false)
    onClose()
  }

  async function handleDelete() {
    if (!app || !onDelete) return
    if (!confirm(`Remove ${app.company}?`)) return
    setLoading(true)
    await onDelete(app.id)
    setLoading(false)
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '16px',
    }}>
      <div className="fade-up" style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border)', padding: '22px',
        width: '100%', maxWidth: '360px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>
          {app ? 'Edit application' : 'Add application'}
        </h3>

        <form onSubmit={handleSave}>
          <Field label="Company *">
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Wise" autoFocus />
          </Field>
          <Field label="Role *">
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Technical Support Engineer" />
          </Field>
          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value as Status)}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Date applied">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Source">
            <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. LinkedIn, Referral, Direct" />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Interview dates, recruiter name, salary range…" />
          </Field>

          {error && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '0.5px solid #F7C1C1', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: '13px', marginBottom: '12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Btn onClick={onClose}>Cancel</Btn>
            {app && onDelete && (
              <Btn onClick={handleDelete} variant="danger">Delete</Btn>
            )}
            <Btn type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>{label}</label>
      {children}
    </div>
  )
}

function Btn({ children, onClick, type = 'button', variant, disabled }: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'danger'
  disabled?: boolean
}) {
  const styles: React.CSSProperties = {
    fontSize: '13px', fontWeight: 500, padding: '8px 16px',
    borderRadius: 'var(--radius)', border: '0.5px solid var(--border2)',
    background: variant === 'primary' ? 'var(--text)' : variant === 'danger' ? 'var(--red-bg)' : 'var(--surface)',
    color: variant === 'primary' ? 'var(--bg)' : variant === 'danger' ? 'var(--red)' : 'var(--text)',
    borderColor: variant === 'danger' ? '#F7C1C1' : variant === 'primary' ? 'var(--text)' : 'var(--border2)',
    opacity: disabled ? 0.6 : 1,
  }
  return <button type={type} onClick={onClick} disabled={disabled} style={styles}>{children}</button>
}
