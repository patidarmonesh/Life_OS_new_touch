import { useState } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { v4 as uuid } from 'uuid'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ConfirmDeleteButton from '../components/ui/ConfirmDeleteButton'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'
import { User, Plus, PhoneCall, Calendar, AlertCircle, Clock, Heart, Users } from 'lucide-react'

export default function RelationshipCRM() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()

  const contacts = state.crm?.contacts || []

  const [form, setForm] = useState({
    name: '',
    relationship: 'Friend', // Family, Friend, Professional, Mentor
    frequencyDays: 14, // default 2 weeks
    birthday: '',
    notes: '',
    phone: '',
  })

  // Calculations
  const overdueCount = contacts.filter(c => {
    const last = c.lastContactedAt ? new Date(c.lastContactedAt) : new Date(c.createdAt)
    const diff = (new Date() - last) / (1000 * 60 * 60 * 24)
    return diff > c.frequencyDays
  }).length

  function handleSave() {
    if (!form.name.trim()) return

    const newContact = {
      id: uuid(),
      name: form.name.trim(),
      relationship: form.relationship,
      frequencyDays: Number(form.frequencyDays) || 14,
      birthday: form.birthday,
      notes: form.notes.trim(),
      phone: form.phone.trim(),
      createdAt: new Date().toISOString(),
      lastContactedAt: null,
      interactions: [],
    }

    setModule('crm', {
      ...state.crm,
      contacts: [newContact, ...contacts],
    })

    setForm({
      name: '',
      relationship: 'Friend',
      frequencyDays: 14,
      birthday: '',
      notes: '',
      phone: '',
    })

    showToast('Contact added to CRM! 👥 Keep connections warm.', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleLogContact(id) {
    const time = new Date().toISOString()
    const updated = contacts.map(c => {
      if (c.id !== id) return c
      const interaction = {
        id: uuid(),
        date: time,
        note: 'Marked as contacted via CRM quick button.',
      }
      return {
        ...c,
        lastContactedAt: time,
        interactions: [interaction, ...(c.interactions || [])],
      }
    })

    setModule('crm', { ...state.crm, contacts: updated })
    showToast('Catch-up logged! 📞 Streak refreshed.', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  function handleDelete(id) {
    const prev = contacts
    setModule('crm', {
      ...state.crm,
      contacts: contacts.filter(c => c.id !== id),
    })
    showToast('Contact deleted', 'warning', {
      undo: () => setModule('crm', { ...state.crm, contacts: prev }),
    })
    playWarningBeep()
    hapticLight()
  }

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '4px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
  }

  return (
    <div className="legacy-area" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>👥 Relationship CRM</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Nurture your network. Set contact goals for family, friends, and mentors, and track when you last reached out.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>👥</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-indigo)', marginTop: '4px' }}>{contacts.length} Total</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Connections registered</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>⚠️</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent-amber)', marginTop: '4px' }}>{overdueCount} Overdue</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Need a call today</div>
          </Card>
          <Card style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px' }}>🎂</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#EC4899', marginTop: '4px' }}>
              {contacts.filter(c => c.birthday).length} Birthdays
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tracked milestones</div>
          </Card>
        </div>

        {/* Add Connection Form */}
        <Card style={{ padding: '18px' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} color="var(--accent-indigo)" /> Register New Connection
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Contact Name</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Mom, John Doe, Dr. Smith"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Relationship</label>
                <select
                  style={inputStyle}
                  value={form.relationship}
                  onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
                >
                  <option value="Family">👨‍👩‍👧 Family</option>
                  <option value="Friend">🤝 Friend</option>
                  <option value="Mentor">🎓 Mentor</option>
                  <option value="Professional">💼 Professional</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Frequency Goal (Days)</label>
                <input
                  type="number"
                  style={inputStyle}
                  placeholder="7, 30, 90"
                  value={form.frequencyDays}
                  onChange={e => setForm(f => ({ ...f, frequencyDays: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Phone Number (Optional)</label>
                <input
                  style={inputStyle}
                  placeholder="+91 XXXXX XXXXX"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Birthday (Optional)</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={form.birthday}
                  onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Context Notes</label>
                <input
                  style={inputStyle}
                  placeholder="Where you met, topics they like, etc."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button onClick={handleSave} disabled={!form.name.trim()}>
                Add CRM Record
              </Button>
            </div>
          </div>
        </Card>

        {/* Contacts Lists Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '14px' }}>
          {contacts.map(c => {
            const last = c.lastContactedAt ? new Date(c.lastContactedAt) : new Date(c.createdAt)
            const daysSince = Math.round((new Date() - last) / (1000 * 60 * 60 * 24))
            const isOverdue = daysSince > c.frequencyDays

            return (
              <Card
                key={c.id}
                style={{
                  padding: '16px',
                  border: isOverdue ? '1px solid rgba(234,179,8,0.25)' : '1px solid var(--border)',
                  background: isOverdue
                    ? 'linear-gradient(135deg, rgba(234,179,8,0.03) 0%, rgba(15,23,42,0.4) 100%)'
                    : 'rgba(15,23,42,0.4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                    }}>
                      {c.relationship === 'Family' ? '👨‍👩‍👧' : c.relationship === 'Mentor' ? '🎓' : c.relationship === 'Professional' ? '💼' : '🤝'}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: '800', fontSize: '14px' }}>{c.name}</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {c.relationship} • Every {c.frequencyDays} days
                      </span>
                    </div>
                  </div>
                  <ConfirmDeleteButton onConfirm={() => handleDelete(c.id)} size={12} label="Remove" />
                </div>

                {/* Overdue Notification Block */}
                <div style={{ marginTop: '12px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last contacted:</span>
                    <span style={{
                      fontWeight: '700',
                      color: isOverdue ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    }}>
                      {c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleDateString() : 'Never logged'} ({daysSince}d ago)
                    </span>
                  </div>

                  {isOverdue && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#FCD34D',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: 'rgba(234,179,8,0.08)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                    }}>
                      <AlertCircle size={12} /> Contact overdue by {daysSince - c.frequencyDays} days!
                    </div>
                  )}
                </div>

                {/* Description notes */}
                {c.notes && (
                  <p style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    padding: '8px',
                    borderRadius: '8px',
                    margin: '6px 0 10px',
                  }}>
                    💡 {c.notes}
                  </p>
                )}

                {/* Actions Panel */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      onClick={() => playSubtleClick()}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        textAlign: 'center',
                        fontWeight: '600',
                      }}
                    >
                      <PhoneCall size={12} /> Call
                    </a>
                  )}
                  <Button
                    variant="secondary"
                    style={{ flex: 2, padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onClick={() => handleLogContact(c.id)}
                  >
                    <Clock size={12} /> Log Catch-up
                  </Button>
                </div>

                {/* Birthday pill footer */}
                {c.birthday && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#EC4899',
                    marginTop: '10px',
                    borderTop: '1px solid rgba(148,163,184,0.04)',
                    paddingTop: '6px',
                  }}>
                    <Calendar size={10} /> Birthday: {c.birthday}
                  </div>
                )}
              </Card>
            )
          })}

          {contacts.length === 0 && (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>👋</div>
              <div style={{ fontWeight: '700' }}>No connections yet</div>
              <div style={{ fontSize: '12px' }}>Add family members, close friends, or mentors above to stay in touch.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
