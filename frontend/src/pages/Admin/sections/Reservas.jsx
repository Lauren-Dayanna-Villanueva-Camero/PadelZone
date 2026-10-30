import { useState } from 'react'
import { getReservasApi, cancelarReservaApi, getErrorMessage } from '../../../services/api'
import { formatPrice, toDateKey, todayKey } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import { PageHeader, ErrorBanner, Loading, EmptyState, ConfirmDialog } from '../components/AdminUI'

const estadoTone = { confirmada: 'ok', pendiente: 'warn', cancelada: 'off' }

function Reservas() {
  // El backend devuelve todas las reservas cuando quien pide es admin
  const { items: reservas, loading, error, reload } = useAdminResource(getReservasApi)
  const { loadStats } = useAdmin()

  const [estado, setEstado] = useState('')
  const [fecha, setFecha] = useState('')
  const [periodo, setPeriodo] = useState('proximas')
  const [search, setSearch] = useState('')

  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const hoy = todayKey()
  const term = search.trim().toLowerCase()

  const visible = reservas
    .filter(r => !estado || r.estado === estado)
    .filter(r => !fecha || toDateKey(r.fecha) === fecha)
    .filter(r => fecha || periodo === 'todas' || (periodo === 'proximas' ? toDateKey(r.fecha) >= hoy : toDateKey(r.fecha) < hoy))
    .filter(r => !term || [
      r.usuario_id?.nombre, r.usuario_id?.apellido, r.usuario_id?.email, r.cancha_id?.nombre
    ].some(v => v?.toLowerCase().includes(term)))
    .sort((a, b) => {
      const ka = toDateKey(a.fecha) + a.hora_inicio
      const kb = toDateKey(b.fecha) + b.hora_inicio
      return periodo === 'pasadas' ? kb.localeCompare(ka) : ka.localeCompare(kb)
    })

  const ingresos = visible.filter(r => r.estado !== 'cancelada').reduce((s, r) => s + (r.precio || 0), 0)

  const handleCancel = async () => {
    setBusy(true)
    setConfirmError('')
    try {
      await cancelarReservaApi(confirm._id)
      setConfirm(null)
      reload()
      loadStats()
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo cancelar la reserva'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Reservas"
        subtitle={`${visible.length} reservas en la vista · ${formatPrice(ingresos)} sin contar canceladas`}
      />

      <div className="adm-toolbar">
        <input
          type="search"
          placeholder="Buscar cliente o cancha..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} disabled={!!fecha}>
          <option value="proximas">Próximas</option>
          <option value="pasadas">Pasadas</option>
          <option value="todas">Todas</option>
        </select>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} aria-label="Filtrar por fecha" style={{ minWidth: 0 }} />
        <select value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="confirmada">Confirmadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="cancelada">Canceladas</option>
        </select>
        {fecha && (
          <button className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => setFecha('')}>Quitar fecha</button>
        )}
      </div>

      <ErrorBanner message={error} onRetry={reload} />

      <div className="adm-card">
        {loading ? <Loading /> : visible.length === 0 ? (
          <EmptyState icon="event_busy" text="No hay reservas con estos filtros." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Cancha</th>
                  <th>Cliente</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r._id} className={r.estado === 'cancelada' ? 'is-inactive' : ''}>
                    <td>{toDateKey(r.fecha)}</td>
                    <td>{r.hora_inicio} – {r.hora_fin}</td>
                    <td>{r.cancha_id?.nombre || <span className="adm-muted">Cancha eliminada</span>}</td>
                    <td>
                      {r.usuario_id ? `${r.usuario_id.nombre} ${r.usuario_id.apellido}` : 'Usuario eliminado'}
                      <div className="adm-muted">{r.usuario_id?.email}</div>
                    </td>
                    <td>{formatPrice(r.precio)}</td>
                    <td><span className={`adm-badge adm-badge--${estadoTone[r.estado]}`}>{r.estado}</span></td>
                    <td className="adm-actions">
                      {r.estado !== 'cancelada' && (
                        <button
                          className="adm-icon-btn adm-icon-btn--danger"
                          title="Cancelar reserva"
                          onClick={() => { setConfirmError(''); setConfirm(r) }}
                        >
                          <i className="material-icons">event_busy</i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title="Cancelar reserva"
          message={`Se cancelará la reserva de ${confirm.cancha_id?.nombre || 'la cancha'} el ${toDateKey(confirm.fecha)} de ${confirm.hora_inicio} a ${confirm.hora_fin}. El horario quedará libre.`}
          confirmText="Cancelar reserva"
          busy={busy}
          error={confirmError}
          onConfirm={handleCancel}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default Reservas
