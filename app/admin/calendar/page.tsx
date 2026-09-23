import { requireAdminPage } from '@/lib/auth/guard'
import { listAppointments } from '@/lib/services/booking'
import { setStatusAction, blockDayAction } from './actions'

export const metadata = { title: 'Calendrier', robots: { index: false } }

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  DECLINED: 'Refusé',
  CANCELLED: 'Annulé',
  COMPLETED: 'Terminé',
}

export default async function CalendarPage() {
  await requireAdminPage()
  const appointments = await listAppointments()

  const pending = appointments.filter((a) => a.status === 'PENDING')

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <h1 className="display display--section">Agenda</h1>
      <p className="mono" style={{ marginTop: 'var(--space-2)' }}>
        {appointments.length} rendez-vous · {pending.length} en attente
      </p>

      <form action={blockDayAction} style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'end' }}>
        <div className="field">
          <label className="field__label" htmlFor="block-date">Bloquer une journée</label>
          <input className="field__input" id="block-date" name="date" type="date" required />
        </div>
        <button className="btn" type="submit">Bloquer</button>
      </form>

      <table className="admin-table" style={{ marginTop: 'var(--space-8)' }}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Service</th>
            <th scope="col">Demandeur</th>
            <th scope="col">Statut</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td className="mono mono--data">{a.startsAt.toLocaleString('fr-FR')}</td>
              <td>{a.service.name}</td>
              <td>
                {a.contact.name}
                <div className="mono">{a.contact.email}</div>
                {a.guestNote && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-muted)' }}>
                    {a.guestNote}
                  </p>
                )}
              </td>
              <td>
                <span className={`badge ${a.status === 'CONFIRMED' ? 'badge--live' : a.status === 'PENDING' ? 'badge--urgent' : 'badge--draft'}`}>
                  {STATUS_LABELS[a.status]}
                </span>
              </td>
              <td>
                {(a.status === 'PENDING' || a.status === 'CONFIRMED') && (
                  <form action={setStatusAction} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input type="hidden" name="id" value={a.id} />
                    {a.status === 'PENDING' && (
                      <button name="status" value="CONFIRMED" className="mono" style={btnStyle}>
                        Accepter
                      </button>
                    )}
                    {a.status === 'PENDING' && (
                      <button name="status" value="DECLINED" className="mono" style={btnStyle}>
                        Refuser
                      </button>
                    )}
                    <button
                      name="status"
                      value="CANCELLED"
                      className="mono"
                      style={{ ...btnStyle, color: 'var(--color-vermilion)' }}
                    >
                      Annuler
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const btnStyle = { background: 'none', border: 0, cursor: 'pointer' } as const
