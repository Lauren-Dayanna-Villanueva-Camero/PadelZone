import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMultasApi, anularMultaApi, getErrorMessage } from '../../../services/api'
import { formatPrice } from '../../../utils/helpers'
import { formatFechaHora } from '../../../components/Pago/pagoUtils'
import Avatar from '../../../components/Avatar/Avatar'
import { PageHeader, ErrorBanner, Loading, EmptyState, Modal, Field } from '../components/AdminUI'
import './Pagos.css'

const estadoTone = { pendiente: 'danger', pagada: 'ok', anulada: 'off' }
const estadoTexto = { pendiente: 'Pendiente', pagada: 'Pagada', anulada: 'Anulada' }

// Multas por no asistir a reservas que se iban a pagar en la sede. Se crean
// desde Reservas (botón "No asistió"); aquí se ven y se pueden perdonar.
function Multas() {
  const [estado, setEstado] = useState('pendiente')
  const [data, setData] = useState({ multas: [], resumen: null, reglas: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [anular, setAnular] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [accionError, setAccionError] = useState('')
  const [busy, setBusy] = useState(false)

  const cargar = useCallback(async (isCancelled = () => false) => {
    setLoading(true)
    setError('')
    try {
      const res = await getMultasApi(estado)
      if (!isCancelled()) setData(res.data)
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudieron cargar las multas'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [estado])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar y al cambiar el filtro
    cargar(() => cancelled)
    return () => { cancelled = true }
  }, [cargar])

  const enviarAnulacion = async () => {
    setBusy(true)
    setAccionError('')
    try {
      await anularMultaApi(anular._id, motivo.trim())
      setAnular(null)
      cargar()
    } catch (err) {
      setAccionError(getErrorMessage(err, 'No se pudo anular la multa'))
    } finally {
      setBusy(false)
    }
  }

  const { multas, resumen, reglas } = data
  const term = search.trim().toLowerCase()
  const visibles = multas.filter(m => !term || [
    m.usuario_id?.nombre, m.usuario_id?.apellido, m.usuario_id?.email, m.descripcion
  ].some(v => v?.toLowerCase().includes(term)))

  const tarjeta = (clave, label, tono, texto) => (
    <button
      type="button"
      className={`pagos-kpi pagos-kpi--${tono} ${estado === clave ? 'activo' : ''}`}
      onClick={() => setEstado(e => (e === clave ? '' : clave))}
    >
      <span className="pagos-kpi-label">{label}</span>
      <strong>{formatPrice(resumen?.[clave]?.monto)}</strong>
      <span className="adm-muted">{resumen?.[clave]?.cantidad ?? 0} {texto}</span>
    </button>
  )

  return (
    <div>
      <PageHeader
        title="Multas"
        subtitle="Cobros por no asistir a reservas que se iban a pagar en la sede"
      />

      {reglas && (
        <div className="adm-alert adm-alert--info multas-reglas">
          <i className="material-icons">info</i>
          <span>
            Se marcan desde <Link to="/admin/reservas">Reservas</Link> con el botón <strong>No asistió</strong>.
            La multa es el <strong>{reglas.porcentaje}%</strong> del precio de la reserva; mientras esté pendiente el usuario no puede reservar.
            Con <strong>{reglas.limite_inasistencias}</strong> o más inasistencias en {reglas.dias_historial} días sus reservas solo se pagan en línea.
          </span>
        </div>
      )}

      {resumen && (
        <div className="pagos-resumen multas-resumen">
          {tarjeta('pendiente', 'Por cobrar', 'danger', 'multas pendientes')}
          {tarjeta('pagada', 'Cobradas', 'ok', 'multas pagadas')}
          {tarjeta('anulada', 'Perdonadas', 'off', 'multas anuladas')}
        </div>
      )}

      <div className="adm-toolbar pagos-filtros">
        <input type="search" placeholder="Buscar usuario o reserva..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={estado} onChange={e => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="pagada">Pagadas</option>
          <option value="anulada">Anuladas</option>
        </select>
      </div>

      <ErrorBanner message={error} onRetry={() => cargar()} />

      <div className="adm-card">
        {loading && !multas.length ? <Loading /> : visibles.length === 0 ? (
          <EmptyState icon="gavel" text={estado === 'pendiente' ? 'No hay multas pendientes.' : 'No hay multas con estos filtros.'} />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Reserva</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(m => (
                  <tr key={m._id} className={m.estado === 'anulada' ? 'is-inactive' : ''}>
                    <td>
                      {formatFechaHora(m.createdAt)}
                      {m.registrada_por && <div className="adm-muted">por {m.registrada_por.nombre}</div>}
                    </td>
                    <td>
                      <span className="adm-persona">
                        <Avatar persona={m.usuario_id} size={30} />
                        <span>
                          {m.usuario_id ? `${m.usuario_id.nombre} ${m.usuario_id.apellido ?? ''}` : 'Usuario eliminado'}
                          <div className="adm-muted">{m.usuario_id?.email}</div>
                        </span>
                      </span>
                    </td>
                    <td>{m.descripcion.replace(/^Multa por no asistir · /, '')}</td>
                    <td><strong>{formatPrice(m.monto)}</strong></td>
                    <td>
                      <span className={`adm-badge adm-badge--${estadoTone[m.estado]}`}>{estadoTexto[m.estado]}</span>
                      {m.estado === 'pagada' && m.pagada_en && <div className="adm-muted">{formatFechaHora(m.pagada_en)}</div>}
                      {m.estado === 'anulada' && m.motivo_anulacion && <div className="adm-muted">{m.motivo_anulacion}</div>}
                    </td>
                    <td className="adm-actions">
                      {m.estado === 'pendiente' && (
                        <button
                          className="adm-icon-btn"
                          title="Perdonar multa"
                          onClick={() => { setAccionError(''); setMotivo(''); setAnular(m) }}
                        >
                          <i className="material-icons">block</i>
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

      {anular && (
        <Modal title="Perdonar multa" onClose={() => setAnular(null)}>
          <p className="adm-confirm-text">
            La multa de {formatPrice(anular.monto)} de {anular.usuario_id?.nombre ?? 'este usuario'} quedará anulada
            y podrá volver a reservar. La inasistencia no contará para el límite.
          </p>
          <Field label="Motivo" full>
            <textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} placeholder="Ej.: avisó con anticipación que no podía ir" />
          </Field>
          <ErrorBanner message={accionError} />
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn--ghost" onClick={() => setAnular(null)} disabled={busy}>Volver</button>
            <button className="adm-btn adm-btn--danger" onClick={enviarAnulacion} disabled={busy || motivo.trim().length < 3}>
              {busy ? 'Procesando...' : 'Perdonar multa'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Multas
