import { useState } from 'react'
import { aprobarSolicitudApi, rechazarSolicitudApi, getErrorMessage } from '../../../services/api'
import { formatPrice, formatDateLong, formatDateShort, formatHour } from '../../../utils/helpers'
import { ErrorBanner, Loading, EmptyState, Modal, Field } from './AdminUI'

const estadoTone = { pendiente: 'warn', aprobada: 'ok', rechazada: 'danger', cancelada: 'off' }
const estadoLabel = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada' }

const modalidadTexto = (s) => s.modalidad === 'convenio'
  ? s.convenio_meses ? `Convenio nuevo de ${s.convenio_meses} meses` : 'Convenio vigente'
  : 'Alquiler por bloque'

function Dato({ icon, label, children }) {
  return (
    <div className="sol-dato">
      <i className="material-icons">{icon}</i>
      <div>
        <span className="adm-muted">{label}</span>
        <div>{children}</div>
      </div>
    </div>
  )
}

// Solicitudes de torneo de empresas: el admin revisa costo y disponibilidad,
// y aprueba (se crea el torneo con sus canchas apartadas) o rechaza con un motivo
function SolicitudesTorneo({ solicitudes, loading, error, reload, onAprobada }) {
  const [filtro, setFiltro] = useState('pendiente')
  const [detalle, setDetalle] = useState(null)
  const [respuesta, setRespuesta] = useState('')
  const [busy, setBusy] = useState(false)
  const [accionError, setAccionError] = useState('')
  const [aviso, setAviso] = useState('')

  const visibles = filtro ? solicitudes.filter(s => s.estado === filtro) : solicitudes

  const abrir = (s) => {
    setDetalle(s)
    setRespuesta('')
    setAccionError('')
  }

  const responder = async (accion) => {
    setBusy(true)
    setAccionError('')
    try {
      const res = accion === 'aprobar'
        ? await aprobarSolicitudApi(detalle._id, respuesta.trim() || undefined)
        : await rechazarSolicitudApi(detalle._id, respuesta.trim())
      setAviso(res.data.message)
      setDetalle(null)
      reload()
      if (accion === 'aprobar') onAprobada()
    } catch (err) {
      setAccionError(getErrorMessage(err, 'No se pudo responder la solicitud'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="adm-toolbar">
        <select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cancelada">Canceladas</option>
          <option value="">Todas</option>
        </select>
      </div>

      <ErrorBanner message={error} onRetry={reload} />
      {aviso && (
        <div className="adm-alert adm-alert--ok" role="status">
          <i className="material-icons">check_circle</i>
          <span>{aviso}</span>
          <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setAviso('')}>Cerrar</button>
        </div>
      )}

      <div className="adm-card">
        {loading ? <Loading text="Cargando solicitudes..." /> : visibles.length === 0 ? (
          <EmptyState icon="business" text={solicitudes.length ? 'Ninguna solicitud con ese estado.' : 'Aún no hay solicitudes de empresas.'} />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Empresa / torneo</th>
                  <th>Días y horario</th>
                  <th>Canchas</th>
                  <th>Modalidad</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(s => (
                  <tr key={s._id}>
                    <td>
                      <strong>{s.empresa.nombre}</strong>
                      <div className="adm-muted">{s.nombre_torneo}</div>
                    </td>
                    <td className="adm-muted">
                      {formatDateShort(s.fecha_inicio)} – {formatDateShort(s.fecha_fin)}
                      <div>{formatHour(s.hora_inicio)} – {formatHour(s.hora_fin)}</div>
                    </td>
                    <td>{s.canchas.filter(Boolean).map(c => c.nombre).join(', ')}</td>
                    <td>{modalidadTexto(s)}</td>
                    <td><strong>{formatPrice(s.costo?.total)}</strong></td>
                    <td>
                      <span className={`adm-badge adm-badge--${estadoTone[s.estado]}`}>{estadoLabel[s.estado]}</span>
                      {s.estado === 'pendiente' && s.conflictos?.length > 0 && (
                        <div className="sol-cruce"><i className="material-icons">event_busy</i>{s.conflictos.length} cruce(s)</div>
                      )}
                    </td>
                    <td>
                      <button className="adm-icon-btn" title="Ver solicitud" onClick={() => abrir(s)}>
                        <i className="material-icons">visibility</i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalle && (
        <Modal title={`Solicitud: ${detalle.nombre_torneo}`} onClose={() => { if (!busy) setDetalle(null) }} wide>
          <div className="tor-detalle-head">
            <span className={`adm-badge adm-badge--${estadoTone[detalle.estado]}`}>{estadoLabel[detalle.estado]}</span>
            <span className="adm-muted">Enviada el {formatDateLong(detalle.createdAt)}</span>
          </div>

          <div className="sol-datos">
            <Dato icon="business" label="Empresa">
              <strong>{detalle.empresa.nombre}</strong>{detalle.empresa.nit && ` · NIT ${detalle.empresa.nit}`}
            </Dato>
            <Dato icon="person" label="Contacto">
              {detalle.empresa.contacto} · {detalle.empresa.telefono} · {detalle.empresa.email}
            </Dato>
            <Dato icon="emoji_events" label="Torneo">
              {detalle.nombre_torneo} ({detalle.tipo_torneo}) · hasta {detalle.cupo_maximo_parejas} parejas ·
              inscripción {formatPrice(detalle.precio_inscripcion)}
            </Dato>
            <Dato icon="calendar_today" label="Días y franja">
              {formatDateLong(detalle.fecha_inicio)} – {formatDateLong(detalle.fecha_fin)} ·
              {' '}{formatHour(detalle.hora_inicio)} – {formatHour(detalle.hora_fin)} · partidos de {detalle.duracion_partido_min} min
            </Dato>
            <Dato icon="sports_tennis" label="Canchas">
              {detalle.canchas.filter(Boolean).map(c => `${c.nombre} (${formatPrice(c.precio_por_hora)}/h)`).join(', ')}
            </Dato>
            <Dato icon="how_to_reg" label="Inscripciones">
              Abren el {formatDateLong(detalle.inscripcion_apertura)} y cierran el {formatDateLong(detalle.inscripcion_cierre)}
            </Dato>
            <Dato icon="payments" label={modalidadTexto(detalle)}>
              {detalle.costo?.horas_cancha} horas de cancha · subtotal {formatPrice(detalle.costo?.subtotal)}
              {detalle.costo?.descuento_pct > 0 && ` · descuento ${detalle.costo.descuento_pct} % (−${formatPrice(detalle.costo.descuento)})`}
              {' · '}<strong>total {formatPrice(detalle.costo?.total)}</strong>
            </Dato>
            {detalle.descripcion && <Dato icon="notes" label="Descripción">{detalle.descripcion}</Dato>}
            {detalle.respuesta_admin && <Dato icon="chat" label="Respuesta enviada">{detalle.respuesta_admin}</Dato>}
            {detalle.torneo_id && <Dato icon="link" label="Torneo creado">{detalle.torneo_id.nombre}</Dato>}
          </div>

          {detalle.estado === 'pendiente' && (
            <>
              {detalle.conflictos?.length > 0 ? (
                <div className="adm-alert adm-alert--error sol-conflictos">
                  <i className="material-icons">event_busy</i>
                  <div>
                    <strong>Las canchas ya no están libres en:</strong>
                    <ul>
                      {detalle.conflictos.slice(0, 8).map((c, i) => (
                        <li key={i}>{formatDateShort(c.fecha)} · {c.hora_inicio}–{c.hora_fin} · {c.cancha} ({c.detalle})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="adm-alert adm-alert--ok">
                  <i className="material-icons">event_available</i>
                  <span>Las canchas siguen libres. Al aprobar se crea el torneo y quedan apartadas en ese horario.</span>
                </div>
              )}

              <Field label="Respuesta para la empresa (obligatoria si rechazas)" full>
                <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} maxLength={500} />
              </Field>
              <ErrorBanner message={accionError} />
              <div className="adm-form-actions sol-acciones">
                <button type="button" className="adm-btn adm-btn--ghost tor-btn-danger" disabled={busy || respuesta.trim().length < 3} onClick={() => responder('rechazar')}>
                  <i className="material-icons">close</i> Rechazar
                </button>
                <button type="button" className="adm-btn tor-btn-teal" disabled={busy || detalle.conflictos?.length > 0} onClick={() => responder('aprobar')}>
                  <i className="material-icons">check</i> {busy ? 'Procesando...' : 'Aprobar y crear torneo'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

export default SolicitudesTorneo
