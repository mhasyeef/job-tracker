import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Application, ApplicationInput, Status } from '../types'
import AppModal from '../components/AppModal'

const COLORS = [
  ['#E6F1FB','#0C447C'], ['#EAF3DE','#27500A'], ['#FAEEDA','#633806'],
  ['#FBEAF0','#72243E'], ['#EEEDFE','#3C3489'], ['#E1F5EE','#085041'],
]

function colorFor(name: string): [string, string] {
  let h = 0
  for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length] as [string, string]
}

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const STATUS_META: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  applied:     { label: 'Applied',     bg: '#E6F1FB', color: '#0C447C', dot: '#185FA5' },
  in_progress: { label: 'In Progress', bg: '#FAEEDA', color: '#633806', dot: '#BA7517' },
  offer:       { label: 'Offer',       bg: '#EAF3DE', color: '#27500A', dot: '#3B6D11' },
  rejected:    { label: 'Rejected',    bg: '#FCEBEB', color: '#791F1F', dot: '#A32D2D' },
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: '2-digit' })
}

const PAGE_SIZE = 20

type FilterTab = 'all' | Status

export default function TrackerPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'add' | Application | null>(null)

  const fetchApps = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('applications')
      .select('*')
      .order('date', { ascending: false })
    setApps(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
  fetchApps()

  const channel = supabase
    .channel('applications-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'applications' },
      () => { fetchApps() }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [fetchApps])

  async function handleSave(data: ApplicationInput) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (modal === 'add') {
      await supabase.from('applications').insert({ ...data, user_id: user.id })
    } else if (modal && typeof modal === 'object') {
      await supabase.from('applications').update(data).eq('id', modal.id)
    }
    await fetchApps()
  }

  async function handleDelete(id: string) {
    await supabase.from('applications').delete().eq('id', id)
    await fetchApps()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const filtered = apps
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => {
      if (!search) return true
      const q = search.toLowerCase()
      return a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
    })
    .sort((a, b) => sortAsc
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime()
    )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    total: apps.length,
    active: apps.filter(a => a.status === 'applied' || a.status === 'in_progress').length,
    offers: apps.filter(a => a.status === 'offer').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'applied', label: 'Applied' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'offer', label: 'Offers' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.3px' }}>Applications</h1>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
              {loading ? 'Loading…' : `${apps.length} application${apps.length !== 1 ? 's' : ''} tracked`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setModal('add')} style={btnStyle('primary')}>+ Add</button>
            <button onClick={handleSignOut} style={btnStyle()}>Sign out</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: stats.total, color: 'var(--text)' },
            { label: 'Active', value: stats.active, color: '#185FA5' },
            { label: 'Offers', value: stats.offers, color: '#3B6D11' },
            { label: 'Rejected', value: stats.rejected, color: '#A32D2D' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: "'DM Mono', monospace", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search company or role…"
          style={{ marginBottom: '12px', maxWidth: '100%' }}
        />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setFilter(t.key); setPage(1) }} style={{
              fontSize: '12px', padding: '5px 13px', borderRadius: '20px',
              border: '0.5px solid var(--border)',
              background: filter === t.key ? 'var(--text)' : 'transparent',
              color: filter === t.key ? 'var(--bg)' : 'var(--text2)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text2)', fontSize: '13px' }}>Loading…</div>
          ) : pageData.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text2)', fontSize: '13px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
              No applications match this filter.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <th style={{ ...thStyle, width: '34%' }}>Company / Role</th>
                  <th style={{ ...thStyle, width: '17%' }}>Status</th>
                  <th style={{ ...thStyle, width: '14%', cursor: 'pointer' }} onClick={() => setSortAsc(s => !s)}>
                    Applied {sortAsc ? '↑' : '↓'}
                  </th>
                  <th style={{ ...thStyle, width: '20%' }}>Source</th>
                  <th style={{ ...thStyle, width: '8%', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {pageData.map(app => {
                  const [bg, fg] = colorFor(app.company)
                  const meta = STATUS_META[app.status]
                  return (
                    <tr key={app.id} style={{ borderBottom: '0.5px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 26, height: 26, borderRadius: 6, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                            {initials(app.company)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{app.company}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={app.role}>{app.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: meta.bg, color: meta.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--text2)' }}>
                        {fmtDate(app.date)}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', fontSize: '11px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {app.source || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button onClick={() => setModal(app)} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 14, padding: '3px 5px', borderRadius: 4 }}>✎</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '0.5px solid var(--border)', fontSize: '12px', color: 'var(--text2)' }}>
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={{
                    fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius)',
                    border: '0.5px solid var(--border)',
                    background: p === page ? 'var(--text)' : 'transparent',
                    color: p === page ? 'var(--bg)' : 'var(--text2)',
                  }}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <AppModal
          app={modal === 'add' ? null : modal}
          onSave={handleSave}
          onDelete={modal !== 'add' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px',
  fontSize: '11px', fontWeight: 500,
  color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px',
}

function btnStyle(variant?: 'primary'): React.CSSProperties {
  return {
    fontSize: '13px', fontWeight: 500, padding: '8px 16px',
    borderRadius: 'var(--radius)',
    border: variant === 'primary' ? 'none' : '0.5px solid var(--border2)',
    background: variant === 'primary' ? 'var(--text)' : 'var(--surface)',
    color: variant === 'primary' ? 'var(--bg)' : 'var(--text)',
  }
}
