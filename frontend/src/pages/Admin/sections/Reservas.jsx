import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReservasApi, cancelarReservaApi, marcarNoAsistioApi, quitarNoAsistioApi, getErrorMessage } from '../../../services/api'
import { formatPrice, toDateKey, todayKey } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import { PageHeader, ErrorBanner, Loading, EmptyState, ConfirmDialog } from '../components/AdminUI'
import Avatar from '../../../components/Avatar/Avatar'
import { cargarConfigPagos } from '../../../components/Pago/pagoUtils'

const estadoTone = { confirmada: 'ok', pendiente: 'warn', cancelada: 'off' }
const multaTone = { pendiente: 'danger', pagada: 'ok', anulada: 'off' }
const multaTexto = { pendiente: 'Multa sin pagar', pagada: 'Multa pagada', anulada: 'Multa anulada' }

// Hora de inicio de la reserva (horas de Colombia, UTC-5)
const yaEmpezo = (r) => new Date(`${toDateKey(r.fecha)}T${r.hora_inicio}:00-05:00`) <= new Date()
// Se puede marcar inasistencia si iba a pagar en la sede (sin pagar) y ya debía haber llegado
const puedeMarcarNoAsistio = (r) => r.estado === 'confirmada' && !r.pagada && !r.no_asistio && yaEmpezo(r)

function Reservas() {
  // El backend devuelve todas las reservas cuando quien pide es admin
  const { items: reservas, loading, error, reload } = useAdminResource(getReservasApi)
  const { loadStats } = useAdmin()

  const [estado, setEstado] = useState('')
  const [fecha, setFecha] = useState('')
  const [periodo, setPeriodo] = useState('proximas')
  const [search, setSearch] = useState('')

  const [confirm, setConfirm] = useState(null)
  // { tipo: 'marcar' | 'quitar', reserva }
  const [asistencia, setAsistencia] = useState(null)
  const [porcentaje, setPorcentaje] = useState(null)
  useEffect(() => {
    cargarConfigPagos().then(c => setPorcentaje(c.multas?.porcentaje ?? null)).catch(() => {})
  }, [])
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const hoy = todayKey()
  const term = search.trim().toLowerCase()

  const visible = reservas
    .filter(r => !estado || (estado === 'no_asistio' ? r.no_asistio : r.estado === estado))
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

  const handleAsistencia = async () => {
    setBusy(true)
    setConfirmError('')
    try {
      if (asistencia.tipo === 'marcar') await marcarNoAsistioApi(asistencia.reserva._id)
      else await quitarNoAsistioApi(asistencia.reserva._id)
      setAsistencia(null)
      reload()
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo guardar'))
    } finally {
      setBusy(false)
    }
  }

  const montoMulta = (r) => (porcentaje ? Math.round((r.precio * porcentaje) / 100) : null)

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
          <option value="no_asistio">No asistieron</option>
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
                  <th>Pago</th>
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
                      <span className="adm-persona">
                        <Avatar persona={r.usuario_id} size={30} />
                        <span>
                          {r.usuario_id ? `${r.usuario_id.nombre} ${r.usuario_id.apellido}` : 'Usuario eliminado'}
                          <div className="adm-muted">{r.usuario_id?.email}</div>
                        </span>
                      </span>
                    </td>
                    <td>{formatPrice(r.precio)}</td>
                    <td>
                      {r.no_asistio
                        ? <span className="adm-badge adm-badge--danger">No asistió</span>
                        : (
                          <span className={`adm-badge adm-badge--${estadoTone[r.estado]}`}>
                            {r.estado === 'pendiente' ? 'esperando pago' : r.estado}
                          </span>
                        )}
                    </td>
                    <td>
                      {r.no_asistio
                        ? (
                          <Link to="/admin/multas" className={`adm-badge adm-badge--${multaTone[r.multa_id?.estado] ?? 'danger'}`}>
                            {multaTexto[r.multa_id?.estado] ?? 'Multa'}{r.multa_id ? ` · ${formatPrice(r.multa_id.monto)}` : ''}
                          </Link>
                        )
                        : r.pagada
                        ? <span className="adm-badge adm-badge--ok">Pagada</span>
                        : r.estado === 'cancelada' ? <span className="adm-muted">—</span>
                          : <span className="adm-badge adm-badge--warn">Sin pagar</span>}
                    </td>
                    <td className="adm-actions">
                      {puedeMarcarNoAsistio(r) && (
                        <button
                          className="adm-icon-btn adm-icon-btn--danger"
                          title="No asistió (cobrar multa)"
                          onClick={() => { setConfirmError(''); setAsistencia({ tipo: 'marcar', reserva: r }) }}
                        >
                          <i className="material-icons">person_off</i>
                        </button>
                      )}
                      {r.no_asistio && r.multa_id?.estado !== 'pagada' && (
                        <button
                          className="adm-icon-btn"
                          title="Sí asistió (quitar la multa)"
                          onClick={() => { setConfirmError(''); setAsistencia({ tipo: 'quitar', reserva: r }) }}
                        >
                          <i className="material-icons">how_to_reg</i>
                        </button>
                      )}
                      {r.estado !== 'cancelada' && !r.no_asistio && (
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

      {asistencia && (
        <ConfirmDialog
          title={asistencia.tipo === 'marcar' ? 'Marcar inasistencia' : 'Quitar inasistencia'}
          message={asistencia.tipo === 'marcar'
            ? `${asistencia.reserva.usuario_id?.nombre ?? 'El usuario'} no llegó a la reserva de ${asistencia.reserva.cancha_id?.nombre || 'la cancha'} del ${toDateKey(asistencia.reserva.fecha)} (${asistencia.reserva.hora_inicio}–${asistencia.reserva.hora_fin}). ` +
              `Se le cobrará una multa${montoMulta(asistencia.reserva) != null ? ` de ${formatPrice(montoMulta(asistencia.reserva))} (${porcentaje}% del precio)` : ''} y no podrá reservar hasta pagarla.`
            : `Se quitará la marca de inasistencia y se anulará la multa de ${asistencia.reserva.usuario_id?.nombre ?? 'el usuario'}.`}
          confirmText={asistencia.tipo === 'marcar' ? 'Cobrar multa' : 'Quitar multa'}
          danger={asistencia.tipo === 'marcar'}
          busy={busy}
          error={confirmError}
          onConfirm={handleAsistencia}
          onCancel={() => setAsistencia(null)}
        />
      )}
    </div>
  )
}

export default Reservas
