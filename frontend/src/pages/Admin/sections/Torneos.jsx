import { useState, useEffect } from 'react'
import {
  getTorneosApi,
  getSolicitudesApi,
  getCanchasApi,
  getTorneoByIdApi,
  createTorneoApi,
  updateTorneoApi,
  deleteTorneoApi,
  updateParticipanteApi,
  cerrarInscripcionesApi,
  reorganizarTorneoApi,
  exportarTorneoApi,
  getErrorMessage
} from '../../../services/api'
import { formatPrice, formatDateLong, formatDateShort, formatHour, toDateKey } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import Cuadro from '../../../components/Cuadro/Cuadro'
import HorariosPartidos from '../components/HorariosPartidos'
import SolicitudesTorneo from '../components/SolicitudesTorneo'
import {
  PageHeader, ErrorBanner, Loading, EmptyState, Modal, ConfirmDialog, Field
} from '../components/AdminUI'
import './Torneos.css'

const estadoTone = { activo: 'ok', en_curso: 'warn', finalizado: 'info', cancelado: 'off' }
const estadoLabel = { activo: 'Activo', en_curso: 'En curso', finalizado: 'Finalizado', cancelado: 'Cancelado' }

// Con responseType 'blob' el error del backend también llega como Blob
const blobErrorMessage = async (err, fallback) => {
  const data = err.response?.data
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback
    } catch {
      return fallback
    }
  }
  return getErrorMessage(err, fallback)
}

// Quita los caracteres que Windows no admite en nombres de archivo
const nombreArchivo = (nombre) => `${nombre.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'torneo'}.xlsx`

const emptyForm = {
  nombre: '',
  tipo_torneo: 'Amateur',
  fecha_inicio: '',
  fecha_fin: '',
  cupo_maximo_parejas: '16',
  precio_inscripcion: '',
  estado: 'activo',
  inscripcion_apertura: '',
  inscripcion_cierre: '',
  hora_inicio: '08:00',
  hora_fin: '20:00',
  duracion_partido_min: '90',
  canchas: [],
  organizador: ''
}

const toForm = (t) => ({
  nombre: t.nombre,
  tipo_torneo: t.tipo_torneo,
  fecha_inicio: toDateKey(t.fecha_inicio),
  fecha_fin: toDateKey(t.fecha_fin),
  cupo_maximo_parejas: String(t.cupo_maximo_parejas),
  precio_inscripcion: String(t.precio_inscripcion),
  estado: t.estado,
  inscripcion_apertura: toDateKey(t.inscripcion_apertura),
  inscripcion_cierre: toDateKey(t.inscripcion_cierre),
  hora_inicio: t.hora_inicio || '08:00',
  hora_fin: t.hora_fin || '20:00',
  duracion_partido_min: String(t.duracion_partido_min || 90),
  // getTorneos devuelve las canchas con nombre; aquí basta el id
  canchas: (t.canchas || []).map(c => c._id ?? c),
  organizador: t.organizador || ''
})

// Acciones que cambian el estado o la organización: todas piden confirmación
const acciones = {
  cerrar: {
    title: 'Cerrar inscripciones',
    confirmText: 'Cerrar y emparejar',
    danger: false,
    message: (t) => `"${t.nombre}" pasará a en curso y no admitirá más inscripciones. Se respetarán las parejas declaradas, el resto se emparejará al azar y se sorteará el cuadro de eliminación.`,
    run: (t) => cerrarInscripcionesApi(t._id),
    ok: (t) => `Inscripciones de "${t.nombre}" cerradas y parejas organizadas`
  },
  reorganizar: {
    title: 'Reorganizar parejas',
    confirmText: 'Reorganizar',
    danger: false,
    message: (t) => `Se volverá a sortear a los jugadores sin pareja declarada de "${t.nombre}". Las parejas actuales formadas al azar se perderán y el cuadro se volverá a sortear (se borran los resultados registrados).`,
    run: (t) => reorganizarTorneoApi(t._id),
    ok: (t) => `Parejas de "${t.nombre}" reorganizadas`
  },
  finalizar: {
    title: 'Finalizar torneo',
    confirmText: 'Finalizar',
    danger: false,
    message: (t) => `"${t.nombre}" pasará a finalizado. La organización de parejas se conserva.`,
    run: (t) => updateTorneoApi(t._id, { estado: 'finalizado' }),
    ok: (t) => `"${t.nombre}" finalizado`
  },
  cancelar: {
    title: 'Cancelar torneo',
    confirmText: 'Cancelar torneo',
    danger: true,
    message: (t) => `"${t.nombre}" pasará a estado cancelado y no admitirá más inscripciones. Los inscritos verán el torneo como cancelado.`,
    run: (t) => deleteTorneoApi(t._id),
    ok: (t) => `"${t.nombre}" cancelado`
  }
}

function Integrante({ i }) {
  return (
    <li className="tor-integrante">
      <div className="tor-integrante-nombre">
        <i className="material-icons">person</i>
        <strong>{i.nombre}</strong>
        {!i.inscrito && <span className="adm-badge adm-badge--info" title="Declarado como pareja, sin inscripción propia">Invitado</span>}
      </div>
      <div className="adm-muted">
        {[i.email, i.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
      </div>
    </li>
  )
}

function Torneos() {
  const { items: torneos, loading, error, reload } = useAdminResource(getTorneosApi)
  const solicitudesRes = useAdminResource(getSolicitudesApi)
  const pendientes = solicitudesRes.items.filter(s => s.estado === 'pendiente').length
  const { loadStats } = useAdmin()
  const [vista, setVista] = useState('torneos') // 'torneos' | 'solicitudes'
  const [canchas, setCanchas] = useState([])

  useEffect(() => {
    let cancelled = false
    getCanchasApi(true)
      .then(res => { if (!cancelled) setCanchas(res.data) })
      .catch(() => { if (!cancelled) setCanchas([]) })
    return () => { cancelled = true }
  }, [])

  const [filtro, setFiltro] = useState('')

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // { tipo: keyof acciones, torneo }
  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const [detalle, setDetalle] = useState(null) // torneo con participantes y organización
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [detalleError, setDetalleError] = useState('')
  const [tab, setTab] = useState('organizacion')
  const [cuadroVersion, setCuadroVersion] = useState(0) // fuerza recargar el cuadro tras cerrar o reorganizar

  const [aviso, setAviso] = useState(null) // { tone: 'ok' | 'warn' | 'error', text }
  const [exportando, setExportando] = useState(null) // id del torneo que se está exportando

  const visible = filtro ? torneos.filter(t => t.estado === filtro) : torneos

  const openNew = () => { setForm(emptyForm); setFormError(''); setEditing('new') }
  const openEdit = (t) => { setForm(toForm(t)); setFormError(''); setEditing(t) }
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const toggleCancha = (id) => setForm(f => ({
    ...f,
    canchas: f.canchas.includes(id) ? f.canchas.filter(c => c !== id) : [...f.canchas, id]
  }))

  const handleSave = async (e) => {
    e.preventDefault()
    const cupo = Number(form.cupo_maximo_parejas)
    const precio = Number(form.precio_inscripcion)
    if (form.nombre.trim().length < 2) return setFormError('El nombre debe tener al menos 2 caracteres')
    if (!form.fecha_inicio || !form.fecha_fin) return setFormError('Indica las fechas de inicio y fin')
    if (form.fecha_fin < form.fecha_inicio) return setFormError('La fecha de fin no puede ser anterior a la de inicio')
    if (!Number.isInteger(cupo) || cupo < 1) return setFormError('El cupo debe ser un entero mayor que 0')
    if (!Number.isFinite(precio) || precio < 0) return setFormError('El precio de inscripción no es válido')
    if (Boolean(form.inscripcion_apertura) !== Boolean(form.inscripcion_cierre)) {
      return setFormError('Indica la apertura y el cierre de las inscripciones')
    }
    if (form.inscripcion_cierre && form.inscripcion_cierre < form.inscripcion_apertura) {
      return setFormError('El cierre de inscripciones no puede ser anterior a la apertura')
    }
    if (form.inscripcion_cierre && form.inscripcion_cierre >= form.fecha_inicio) {
      return setFormError('Las inscripciones deben cerrar antes del día de inicio del torneo')
    }
    if (form.hora_fin <= form.hora_inicio) return setFormError('La hora de fin de los partidos debe ser posterior a la de inicio')

    const payload = {
      nombre: form.nombre.trim(),
      tipo_torneo: form.tipo_torneo,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      cupo_maximo_parejas: cupo,
      precio_inscripcion: precio,
      estado: form.estado,
      inscripcion_apertura: form.inscripcion_apertura || null,
      inscripcion_cierre: form.inscripcion_cierre || null,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      duracion_partido_min: Number(form.duracion_partido_min),
      canchas: form.canchas,
      organizador: form.organizador.trim()
    }

    setSaving(true)
    setFormError('')
    try {
      const res = editing === 'new' ? await createTorneoApi(payload) : await updateTorneoApi(editing._id, payload)
      // Avisos del backend: alguien sin pareja o cruces con reservas
      if (res.data.aviso) setAviso({ tone: 'warn', text: res.data.aviso })
      setEditing(null)
      reload()
      loadStats()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el torneo'))
    } finally {
      setSaving(false)
    }
  }

  const loadDetalle = async (id) => {
    setDetalleLoading(true)
    setDetalleError('')
    try {
      const res = await getTorneoByIdApi(id)
      setDetalle(res.data)
    } catch (err) {
      setDetalleError(getErrorMessage(err, 'No se pudo cargar el detalle del torneo'))
    } finally {
      setDetalleLoading(false)
    }
  }

  const openDetalle = (t) => {
    setDetalle(t)
    setTab(t.estado === 'activo' ? 'inscritos' : 'organizacion')
    loadDetalle(t._id)
  }

  const pedirConfirmacion = (tipo, torneo) => {
    setConfirmError('')
    setConfirm({ tipo, torneo })
  }

  const handleConfirm = async () => {
    const { tipo, torneo } = confirm
    const accion = acciones[tipo]
    setBusy(true)
    setConfirmError('')
    try {
      const res = await accion.run(torneo)
      // El backend avisa si alguien quedó sin pareja asignada
      setAviso(res.data.aviso
        ? { tone: 'warn', text: `${accion.ok(torneo)}. ${res.data.aviso}` }
        : { tone: 'ok', text: accion.ok(torneo) })
      setConfirm(null)
      reload()
      loadStats()
      if (detalle?._id === torneo._id) {
        loadDetalle(torneo._id)
        setCuadroVersion(v => v + 1)
      }
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo completar la acción'))
    } finally {
      setBusy(false)
    }
  }

  const exportar = async (t) => {
    setExportando(t._id)
    setAviso(null)
    try {
      const res = await exportarTorneoApi(t._id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivo(t.nombre)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setAviso({ tone: 'error', text: await blobErrorMessage(err, 'No se pudo exportar el torneo') })
    } finally {
      setExportando(null)
    }
  }

  const togglePago = async (p) => {
    setDetalleError('')
    try {
      await updateParticipanteApi(detalle._id, p._id, { pago_confirmado: !p.pago_confirmado })
      setDetalle(d => ({
        ...d,
        participantes: d.participantes.map(x => x._id === p._id ? { ...x, pago_confirmado: !x.pago_confirmado } : x)
      }))
    } catch (err) {
      setDetalleError(getErrorMessage(err, 'No se pudo actualizar el pago'))
    }
  }

  const botonExportar = (t, small = true) => (
    <button
      type="button"
      className={`adm-btn adm-btn--ghost ${small ? 'adm-btn--small' : ''}`}
      onClick={() => exportar(t)}
      disabled={exportando === t._id}
    >
      <i className={`material-icons ${exportando === t._id ? 'tor-spin' : ''}`}>
        {exportando === t._id ? 'autorenew' : 'download'}
      </i>
      {exportando === t._id ? 'Exportando...' : 'Exportar a Excel'}
    </button>
  )

  // Botones según el estado del torneo
  const botonesEstado = (t) => (
    <>
      {t.estado === 'activo' && (
        <button type="button" className="adm-btn adm-btn--small tor-btn-teal" onClick={() => pedirConfirmacion('cerrar', t)}>
          <i className="material-icons">lock</i> Cerrar inscripciones y emparejar
        </button>
      )}
      {t.estado === 'en_curso' && (
        <>
          <button type="button" className="adm-btn adm-btn--small tor-btn-teal" onClick={() => pedirConfirmacion('reorganizar', t)}>
            <i className="material-icons">shuffle</i> Reorganizar parejas
          </button>
          <button type="button" className="adm-btn adm-btn--small" onClick={() => pedirConfirmacion('finalizar', t)}>
            <i className="material-icons">flag</i> Finalizar
          </button>
        </>
      )}
      {(t.estado === 'activo' || t.estado === 'en_curso') && (
        <button type="button" className="adm-btn adm-btn--small adm-btn--ghost tor-btn-danger" onClick={() => pedirConfirmacion('cancelar', t)}>
          <i className="material-icons">block</i> Cancelar
        </button>
      )}
    </>
  )

  const org = detalle?.organizacion
  const accionConfirm = confirm && acciones[confirm.tipo]

  return (
    <div>
      <PageHeader
        title="Torneos"
        subtitle="Programa torneos, cierra inscripciones, organiza las parejas y responde las solicitudes de empresas"
        action={vista === 'torneos' && (
          <button className="adm-btn" onClick={openNew}>
            <i className="material-icons">add</i> Nuevo torneo
          </button>
        )}
      />

      <div className="tor-tabs tor-vistas" role="tablist">
        <button type="button" role="tab" aria-selected={vista === 'torneos'} className={vista === 'torneos' ? 'is-active' : ''} onClick={() => setVista('torneos')}>
          <i className="material-icons">emoji_events</i> Torneos
        </button>
        <button type="button" role="tab" aria-selected={vista === 'solicitudes'} className={vista === 'solicitudes' ? 'is-active' : ''} onClick={() => setVista('solicitudes')}>
          <i className="material-icons">business</i> Solicitudes de empresas
          {pendientes > 0 && <span className="tor-tab-count">{pendientes}</span>}
        </button>
      </div>

      {vista === 'solicitudes' && (
        <SolicitudesTorneo
          solicitudes={solicitudesRes.items}
          loading={solicitudesRes.loading}
          error={solicitudesRes.error}
          reload={solicitudesRes.reload}
          onAprobada={() => { reload(); loadStats() }}
        />
      )}

      {vista === 'torneos' && (<>
      <div className="adm-toolbar">
        <select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="en_curso">En curso</option>
          <option value="finalizado">Finalizados</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>

      <ErrorBanner message={error} onRetry={reload} />
      {aviso && (
        <div className={`adm-alert adm-alert--${aviso.tone}`} role="status">
          <i className="material-icons">{aviso.tone === 'ok' ? 'check_circle' : aviso.tone === 'warn' ? 'warning' : 'error_outline'}</i>
          <span>{aviso.text}</span>
          <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setAviso(null)}>Cerrar</button>
        </div>
      )}

      <div className="adm-card">
        {loading ? <Loading text="Cargando torneos..." /> : visible.length === 0 ? (
          <EmptyState icon="emoji_events" text={torneos.length ? 'Ningún torneo con ese estado.' : 'Aún no hay torneos.'} />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fechas</th>
                  <th>Parejas / cupo</th>
                  <th>Inscripción</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => {
                  const ocupadas = t.parejas_inscritas ?? 0
                  const pct = Math.min((ocupadas / t.cupo_maximo_parejas) * 100, 100)
                  return (
                    <tr key={t._id} className={t.estado === 'cancelado' ? 'is-inactive' : ''}>
                      <td>
                        <strong>{t.nombre}</strong>
                        <div className="adm-muted">{t.tipo_torneo}</div>
                      </td>
                      <td className="adm-muted">
                        {formatDateLong(t.fecha_inicio)} – {formatDateLong(t.fecha_fin)}
                        {t.inscripcion_apertura && (
                          <div className="tor-insc">
                            Inscripciones: {formatDateShort(t.inscripcion_apertura)} – {formatDateShort(t.inscripcion_cierre)}
                            {t.fase_inscripcion === 'proximamente' && <span className="adm-badge adm-badge--info">Próximamente</span>}
                          </div>
                        )}
                        {t.organizador && <div className="tor-insc">Organiza: {t.organizador}</div>}
                      </td>
                      <td>
                        <div className="tor-cupo" title={`${t.participantes_inscritos} jugadores inscritos`}>
                          <span><strong>{ocupadas}</strong> / {t.cupo_maximo_parejas}</span>
                          <div className="tor-cupo-bar"><div style={{ width: `${pct}%` }} /></div>
                        </div>
                      </td>
                      <td>{formatPrice(t.precio_inscripcion)}</td>
                      <td><span className={`adm-badge adm-badge--${estadoTone[t.estado]}`}>{estadoLabel[t.estado]}</span></td>
                      <td>
                        <div className="tor-acciones">
                          {botonesEstado(t)}
                          <button className="adm-icon-btn" title="Ver organización e inscritos" onClick={() => openDetalle(t)}>
                            <i className="material-icons">groups</i>
                          </button>
                          <button
                            className="adm-icon-btn"
                            title="Exportar a Excel"
                            disabled={exportando === t._id}
                            onClick={() => exportar(t)}
                          >
                            <i className={`material-icons ${exportando === t._id ? 'tor-spin' : ''}`}>
                              {exportando === t._id ? 'autorenew' : 'download'}
                            </i>
                          </button>
                          <button className="adm-icon-btn" title="Editar" onClick={() => openEdit(t)}>
                            <i className="material-icons">edit</i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}

      {editing && (
        <Modal title={editing === 'new' ? 'Nuevo torneo' : `Editar ${editing.nombre}`} onClose={() => setEditing(null)}>
          <form className="adm-form" onSubmit={handleSave}>
            <ErrorBanner message={formError} />
            <Field label="Nombre *" full>
              <input value={form.nombre} onChange={set('nombre')} required />
            </Field>
            <Field label="Tipo *">
              <select value={form.tipo_torneo} onChange={set('tipo_torneo')}>
                <option value="Amateur">Amateur</option>
                <option value="Profesional">Profesional</option>
                <option value="Comunidad">Comunidad</option>
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.estado} onChange={set('estado')}>
                <option value="activo">Activo</option>
                <option value="en_curso">En curso</option>
                <option value="finalizado">Finalizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </Field>
            <Field label="Fecha de inicio *">
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} required />
            </Field>
            <Field label="Fecha de fin *">
              <input type="date" value={form.fecha_fin} min={form.fecha_inicio} onChange={set('fecha_fin')} required />
            </Field>
            <Field label="Cupo máximo (parejas) *">
              <input type="number" min="1" step="1" value={form.cupo_maximo_parejas} onChange={set('cupo_maximo_parejas')} required />
            </Field>
            <Field label="Precio de inscripción (COP) *">
              <input type="number" min="0" step="1000" value={form.precio_inscripcion} onChange={set('precio_inscripcion')} required />
            </Field>
            <Field label="Apertura de inscripciones" hint="Antes de esta fecha el torneo sale como Próximamente">
              <input type="date" value={form.inscripcion_apertura} onChange={set('inscripcion_apertura')} />
            </Field>
            <Field label="Cierre de inscripciones" hint="Debe ser antes del inicio. Pasado ese día se cierran solas y se arman parejas, cuadro y horarios">
              <input
                type="date"
                value={form.inscripcion_cierre}
                min={form.inscripcion_apertura || undefined}
                max={form.fecha_inicio || undefined}
                onChange={set('inscripcion_cierre')}
              />
            </Field>
            <Field label="Partidos desde">
              <input type="time" step="1800" value={form.hora_inicio} onChange={set('hora_inicio')} required />
            </Field>
            <Field label="Partidos hasta">
              <input type="time" step="1800" value={form.hora_fin} onChange={set('hora_fin')} required />
            </Field>
            <Field label="Duración de cada partido">
              <select value={form.duracion_partido_min} onChange={set('duracion_partido_min')}>
                <option value="60">60 minutos</option>
                <option value="90">90 minutos</option>
                <option value="120">120 minutos</option>
              </select>
            </Field>
            <Field label="Organizador (empresa)">
              <input value={form.organizador} onChange={set('organizador')} placeholder="Opcional" />
            </Field>
            <div className="adm-field adm-field--full">
              <span className="adm-field-label">Canchas del torneo</span>
              <div className="tor-canchas">
                {canchas.map(c => (
                  <label className="adm-check" key={c._id}>
                    <input type="checkbox" checked={form.canchas.includes(c._id)} onChange={() => toggleCancha(c._id)} />
                    {c.nombre}{!c.activa && ' (inactiva)'}
                  </label>
                ))}
              </div>
              <span className="adm-field-hint">
                Las canchas elegidas quedan apartadas para reservas en los días y la franja del torneo. Sin canchas, los partidos se reparten en todas las activas sin bloquear reservas.
              </span>
            </div>
            <div className="adm-form-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="adm-btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {detalle && (
        <Modal title={detalle.nombre} onClose={() => { if (!confirm) setDetalle(null) }} wide>
          <div className="tor-detalle-head">
            <span className={`adm-badge adm-badge--${estadoTone[detalle.estado]}`}>{estadoLabel[detalle.estado]}</span>
            <span className="adm-muted">
              {detalle.parejas_inscritas ?? 0} / {detalle.cupo_maximo_parejas} parejas · {detalle.participantes_inscritos ?? 0} jugadores
            </span>
            <div className="tor-acciones">
              {botonesEstado(detalle)}
              {botonExportar(detalle)}
            </div>
          </div>

          <div className="tor-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'organizacion'} className={tab === 'organizacion' ? 'is-active' : ''} onClick={() => setTab('organizacion')}>
              <i className="material-icons">group_work</i> Organización
            </button>
            <button type="button" role="tab" aria-selected={tab === 'horarios'} className={tab === 'horarios' ? 'is-active' : ''} onClick={() => setTab('horarios')}>
              <i className="material-icons">schedule</i> Horarios
            </button>
            <button type="button" role="tab" aria-selected={tab === 'inscritos'} className={tab === 'inscritos' ? 'is-active' : ''} onClick={() => setTab('inscritos')}>
              <i className="material-icons">list</i> Inscritos
            </button>
          </div>

          <ErrorBanner message={detalleError} onRetry={() => loadDetalle(detalle._id)} />

          {detalleLoading && !detalle.participantes ? (
            <Loading text="Cargando detalle..." />
          ) : !detalle.participantes ? null : tab === 'horarios' ? (
            detalle.estado === 'activo' ? (
              <EmptyState icon="schedule" text={`Los horarios se programan al cerrar las inscripciones. Franja del torneo: ${formatHour(detalle.hora_inicio || '08:00')} – ${formatHour(detalle.hora_fin || '20:00')}.`} />
            ) : (
              <HorariosPartidos key={`${detalle._id}-${cuadroVersion}`} torneo={detalle} />
            )
          ) : tab === 'organizacion' ? (
            detalle.estado === 'activo' ? (
              <EmptyState icon="lock_open" text="Las inscripciones siguen abiertas. Las parejas se organizan al cerrar inscripciones." />
            ) : !org || (org.equipos.length === 0 && org.sin_pareja_asignada.length === 0) ? (
              <EmptyState icon="groups" text="Este torneo no tiene parejas organizadas." />
            ) : (
              <>
                <div className="tor-cuadro">
                  <div className="tor-cuadro-head">
                    <i className="material-icons">account_tree</i>
                    Cuadro de eliminación
                  </div>
                  <Cuadro key={`${detalle._id}-${cuadroVersion}`} torneoId={detalle._id} admin />
                </div>

                <div className="tor-equipos">
                  {org.equipos.map(e => (
                    <div className="tor-equipo" key={e.equipo}>
                      <div className="tor-equipo-head">Equipo #{e.equipo}</div>
                      <ul>
                        {e.integrantes.map((i, idx) => <Integrante key={i.usuario_id ?? idx} i={i} />)}
                      </ul>
                    </div>
                  ))}
                </div>

                {org.sin_pareja_asignada.length > 0 && (
                  <div className="tor-sin-pareja">
                    <div className="tor-sin-pareja-head">
                      <i className="material-icons">person_off</i>
                      Sin pareja asignada ({org.sin_pareja_asignada.length})
                    </div>
                    <ul>
                      {org.sin_pareja_asignada.map((i, idx) => <Integrante key={i.usuario_id ?? idx} i={i} />)}
                    </ul>
                  </div>
                )}
              </>
            )
          ) : detalle.participantes.length === 0 ? (
            <EmptyState icon="groups" text="Todavía no hay inscritos." />
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Email</th>
                    <th>Pareja declarada</th>
                    <th>Equipo</th>
                    <th>Inscrito</th>
                    <th>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.participantes.map(p => (
                    <tr key={p._id}>
                      <td>{p.usuario_id ? `${p.usuario_id.nombre} ${p.usuario_id.apellido}` : 'Usuario eliminado'}</td>
                      <td className="adm-muted">{p.usuario_id?.email}</td>
                      <td>{p.pareja_usuario_id ? `${p.pareja_usuario_id.nombre} ${p.pareja_usuario_id.apellido}` : '—'}</td>
                      <td>
                        {p.equipo != null
                          ? <strong>#{p.equipo}</strong>
                          : detalle.estado === 'activo'
                            ? <span className="adm-muted">—</span>
                            : <span className="adm-badge adm-badge--warn">Sin pareja</span>}
                      </td>
                      <td className="adm-muted">{formatDateLong(p.fecha_inscripcion)}</td>
                      <td>
                        <button
                          className={`adm-btn adm-btn--small ${p.pago_confirmado ? '' : 'adm-btn--ghost'}`}
                          onClick={() => togglePago(p)}
                          title="Cambiar estado del pago"
                        >
                          <i className="material-icons">{p.pago_confirmado ? 'check_circle' : 'schedule'}</i>
                          {p.pago_confirmado ? 'Confirmado' : 'Pendiente'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={accionConfirm.title}
          message={accionConfirm.message(confirm.torneo)}
          confirmText={accionConfirm.confirmText}
          danger={accionConfirm.danger}
          busy={busy}
          error={confirmError}
          onConfirm={handleConfirm}
          onCancel={() => { if (!busy) setConfirm(null) }}
        />
      )}
    </div>
  )
}

export default Torneos
