import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getCanchasApi,
  cotizarSolicitudApi,
  createSolicitudApi,
  getMisSolicitudesApi,
  cancelarSolicitudApi,
  getErrorMessage
} from '../../services/api'
import { formatPrice, formatDateLong, formatDateShort, formatHour, todayKey, addDaysKey } from '../../utils/helpers'
import './OrganizaTorneo.css'

// Duraciones de convenio y su descuento (igual que DESCUENTO_CONVENIO en el backend)
const CONVENIOS = [
  { meses: 3, pct: 10 },
  { meses: 6, pct: 15 },
  { meses: 12, pct: 20 }
]

const estadosSolicitud = {
  pendiente: { label: 'En revisión', icon: 'hourglass_top' },
  aprobada: { label: 'Aprobada', icon: 'check_circle' },
  rechazada: { label: 'Rechazada', icon: 'cancel' },
  cancelada: { label: 'Cancelada', icon: 'block' }
}

// Horas en punto y media dentro del horario del club (7:00 a 23:00)
const HORAS = Array.from({ length: 33 }, (_, i) => {
  const min = 7 * 60 + i * 30
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
})

const formInicial = (user) => {
  const hoy = todayKey()
  return {
    empresa: {
      nombre: '',
      nit: '',
      contacto: user ? `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim() : '',
      telefono: user?.telefono ?? '',
      email: user?.email ?? ''
    },
    nombre_torneo: '',
    tipo_torneo: 'Comunidad',
    descripcion: '',
    modalidad: 'bloque',
    convenio_meses: 6,
    fecha_inicio: addDaysKey(hoy, 21),
    fecha_fin: addDaysKey(hoy, 22),
    hora_inicio: '08:00',
    hora_fin: '14:00',
    duracion_partido_min: 90,
    canchas: [],
    cupo_maximo_parejas: '8',
    precio_inscripcion: '0',
    inscripcion_apertura: addDaysKey(hoy, 1),
    inscripcion_cierre: addDaysKey(hoy, 18)
  }
}

const aPayload = (f, conConvenio) => ({
  ...f,
  modalidad: conConvenio ? 'convenio' : f.modalidad,
  convenio_meses: !conConvenio && f.modalidad === 'convenio' ? Number(f.convenio_meses) : null,
  duracion_partido_min: Number(f.duracion_partido_min),
  cupo_maximo_parejas: Number(f.cupo_maximo_parejas),
  precio_inscripcion: Number(f.precio_inscripcion || 0)
})

// Lo mínimo para pedir una cotización al servidor
const listoParaCotizar = (f) =>
  f.canchas.length > 0 && f.fecha_inicio && f.fecha_fin && f.inscripcion_apertura &&
  f.inscripcion_cierre && Number(f.cupo_maximo_parejas) >= 2

function Modalidades() {
  return (
    <div className="org-intro">
      <div className="org-intro-texto">
        <h4>Organiza el torneo de tu empresa en PadelZone</h4>
        <p>
          ¿Tu empresa, colegio o grupo quiere hacer un torneo? Tú eliges los días, el horario y las canchas.
          Nosotros apartamos las canchas, abrimos y cerramos las inscripciones en las fechas que elijas y
          armamos el cuadro con el día, la hora y la cancha de cada partido.
        </p>
      </div>

      <div className="org-modalidades">
        <div className="org-modalidad">
          <i className="material-icons">date_range</i>
          <h6>Alquiler por bloque</h6>
          <p>
            Para un torneo puntual. Apartas las canchas que elijas solo en los días y la franja del torneo
            (por ejemplo, sábado y domingo de 8:00 a 14:00). Pagas las horas de cancha:
            <strong> canchas × horas por día × días</strong>.
          </p>
        </div>
        <div className="org-modalidad destacada">
          <i className="material-icons">handshake</i>
          <h6>Convenio empresarial</h6>
          <p>
            Para empresas que hacen torneos seguido. Firmas un convenio de 3, 6 o 12 meses y obtienes
            <strong> 10 %, 15 % o 20 % de descuento</strong> en este torneo y en todos los que pidas mientras esté vigente.
          </p>
        </div>
      </div>

      <p className="org-nota">
        <i className="material-icons">info</i>
        No se alquila por horas sueltas: un torneo necesita las mismas canchas seguidas durante su franja para
        cumplir el horario de los partidos. Mientras el torneo esté activo, esas canchas no se pueden reservar en ese horario.
      </p>

      <ol className="org-pasos">
        <li><strong>Envías la solicitud</strong> con fechas, franja y canchas, y ves el costo al instante.</li>
        <li><strong>PadelZone la revisa</strong> y la aprueba si las canchas siguen libres.</li>
        <li><strong>Se publica el torneo</strong> y las inscripciones abren y cierran en las fechas que elegiste.</li>
        <li><strong>Al cerrar inscripciones</strong> se forman las parejas y cada jugador ve el horario de sus partidos.</li>
      </ol>
    </div>
  )
}

function Cotizacion({ cotizacion, error, cargando, conConvenio }) {
  if (cargando && !cotizacion) {
    return <div className="org-cotizacion"><p className="org-muted"><i className="material-icons spinning">refresh</i> Calculando...</p></div>
  }
  if (error) {
    return (
      <div className="org-cotizacion">
        <h6>Costo estimado</h6>
        <p className="org-cotizacion-error"><i className="material-icons">error_outline</i>{error}</p>
      </div>
    )
  }
  if (!cotizacion) {
    return (
      <div className="org-cotizacion">
        <h6>Costo estimado</h6>
        <p className="org-muted">Elige al menos una cancha y las fechas para ver el costo.</p>
      </div>
    )
  }

  const { costo, capacidad, conflictos } = cotizacion
  const alcanza = capacidad.partidos_posibles >= capacidad.partidos_necesarios
  return (
    <div className={`org-cotizacion ${cargando ? 'actualizando' : ''}`}>
      <h6>Costo estimado</h6>
      <div className="org-fila"><span>Días</span><span>{costo.dias}</span></div>
      <div className="org-fila"><span>Horas por día</span><span>{costo.horas_por_dia}</span></div>
      <div className="org-fila"><span>Horas de cancha</span><span>{costo.horas_cancha}</span></div>
      <div className="org-fila"><span>Valor por hora (canchas elegidas)</span><span>{formatPrice(costo.valor_hora)}</span></div>
      <div className="org-fila"><span>Subtotal</span><span>{formatPrice(costo.subtotal)}</span></div>
      {costo.descuento_pct > 0 && (
        <div className="org-fila descuento">
          <span>Descuento {conConvenio ? 'convenio vigente' : 'convenio'} ({costo.descuento_pct} %)</span>
          <span>− {formatPrice(costo.descuento)}</span>
        </div>
      )}
      <div className="org-fila total"><span>Total</span><span>{formatPrice(costo.total)}</span></div>

      <div className={`org-capacidad ${alcanza ? 'ok' : 'falta'}`}>
        <i className="material-icons">{alcanza ? 'check_circle' : 'warning'}</i>
        <span>
          Caben {capacidad.partidos_posibles} partidos y el torneo necesita {capacidad.partidos_necesarios}.
          {!alcanza && ' Agrega canchas, horas o días.'}
        </span>
      </div>

      {conflictos.length > 0 ? (
        <div className="org-conflictos">
          <strong><i className="material-icons">event_busy</i> Las canchas no están libres en:</strong>
          <ul>
            {conflictos.slice(0, 6).map((c, i) => (
              <li key={i}>{formatDateShort(c.fecha)} · {formatHour(c.hora_inicio)}–{formatHour(c.hora_fin)} · {c.cancha} ({c.detalle})</li>
            ))}
          </ul>
          {conflictos.length > 6 && <span>y {conflictos.length - 6} más</span>}
        </div>
      ) : (
        <div className="org-capacidad ok">
          <i className="material-icons">event_available</i>
          <span>Las canchas están libres en esos días y horario.</span>
        </div>
      )}
    </div>
  )
}

function MisSolicitudes({ solicitudes, onCancelar, cancelando, onVerTorneos }) {
  if (solicitudes.length === 0) return null
  return (
    <div className="org-mis-solicitudes">
      <h5>Mis solicitudes</h5>
      {solicitudes.map(s => {
        const e = estadosSolicitud[s.estado]
        return (
          <div className="org-solicitud" key={s._id}>
            <div className="org-solicitud-head">
              <div>
                <strong>{s.nombre_torneo}</strong>
                <span className="org-muted"> · {s.empresa.nombre}</span>
              </div>
              <span className={`org-estado ${s.estado}`}><i className="material-icons">{e.icon}</i>{e.label}</span>
            </div>
            <div className="org-solicitud-datos">
              <span><i className="material-icons">calendar_today</i>{formatDateLong(s.fecha_inicio)} – {formatDateLong(s.fecha_fin)}</span>
              <span><i className="material-icons">schedule</i>{formatHour(s.hora_inicio)} – {formatHour(s.hora_fin)}</span>
              <span><i className="material-icons">sports_tennis</i>{s.canchas.map(c => c.nombre).join(', ')}</span>
              <span><i className="material-icons">how_to_reg</i>Inscripciones: {formatDateShort(s.inscripcion_apertura)} – {formatDateShort(s.inscripcion_cierre)}</span>
              <span>
                <i className="material-icons">{s.modalidad === 'convenio' ? 'handshake' : 'date_range'}</i>
                {s.modalidad === 'convenio'
                  ? s.convenio_meses ? `Convenio de ${s.convenio_meses} meses` : 'Con convenio vigente'
                  : 'Alquiler por bloque'}
                {' · '}<strong>{formatPrice(s.costo?.total)}</strong>
              </span>
            </div>
            {s.respuesta_admin && (
              <p className="org-respuesta"><i className="material-icons">chat</i>PadelZone: {s.respuesta_admin}</p>
            )}
            {s.estado === 'aprobada' && s.convenio_vigente_hasta && (
              <p className="org-respuesta ok"><i className="material-icons">verified</i>Convenio vigente hasta el {formatDateLong(s.convenio_vigente_hasta)}</p>
            )}
            <div className="org-solicitud-acciones">
              {s.estado === 'aprobada' && s.torneo_id && (
                <button type="button" className="org-btn-sec" onClick={onVerTorneos}>
                  <i className="material-icons">emoji_events</i> Ver el torneo publicado
                </button>
              )}
              {s.estado === 'pendiente' && (
                <button type="button" className="org-btn-sec peligro" disabled={cancelando === s._id} onClick={() => onCancelar(s)}>
                  <i className="material-icons">close</i> {cancelando === s._id ? 'Cancelando...' : 'Cancelar solicitud'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Pestaña "Organiza tu torneo": modalidades, formulario con cotización en vivo
// y seguimiento de las solicitudes enviadas
function OrganizaTorneo({ onVerTorneos }) {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  const [canchas, setCanchas] = useState([])
  const [form, setForm] = useState(() => formInicial(user))
  const [solicitudes, setSolicitudes] = useState([])
  const [convenio, setConvenio] = useState(null)

  const [cotizacion, setCotizacion] = useState(null)
  const [cotizacionError, setCotizacionError] = useState('')
  const [cotizando, setCotizando] = useState(false)
  const peticion = useRef(0)

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [conflictos, setConflictos] = useState([])
  const [exito, setExito] = useState('')
  const [cancelando, setCancelando] = useState(null)

  const cargarSolicitudes = useCallback(async (isCancelled = () => false) => {
    try {
      const res = await getMisSolicitudesApi()
      if (!isCancelled()) {
        setSolicitudes(res.data.solicitudes)
        setConvenio(res.data.convenio_vigente)
      }
    } catch {
      if (!isCancelled()) setSolicitudes([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getCanchasApi()
      .then(res => { if (!cancelled) setCanchas(res.data) })
      .catch(() => { if (!cancelled) setCanchas([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al iniciar sesión
    cargarSolicitudes(() => cancelled)
    return () => { cancelled = true }
  }, [isAuthenticated, cargarSolicitudes])

  // Cotización en vivo: se pide al servidor medio segundo después del último cambio
  const listo = isAuthenticated && listoParaCotizar(form)
  useEffect(() => {
    if (!listo) return
    const id = ++peticion.current
    const timer = setTimeout(async () => {
      setCotizando(true)
      try {
        const res = await cotizarSolicitudApi(aPayload(form, Boolean(convenio)))
        if (id === peticion.current) { setCotizacion(res.data); setCotizacionError('') }
      } catch (err) {
        if (id === peticion.current) { setCotizacion(null); setCotizacionError(getErrorMessage(err, 'No se pudo calcular el costo')) }
      } finally {
        if (id === peticion.current) setCotizando(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form, listo, convenio])

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))
  // Si la hora de inicio alcanza a la de fin, se corre el fin una hora y media
  const setHoraInicio = (e) => {
    const inicio = e.target.value
    setForm(f => ({
      ...f,
      hora_inicio: inicio,
      hora_fin: f.hora_fin > inicio ? f.hora_fin : HORAS[Math.min(HORAS.indexOf(inicio) + 3, HORAS.length - 1)]
    }))
  }
  const setEmpresa = (campo) => (e) => setForm(f => ({ ...f, empresa: { ...f.empresa, [campo]: e.target.value } }))
  const toggleCancha = (id) => setForm(f => ({
    ...f,
    canchas: f.canchas.includes(id) ? f.canchas.filter(c => c !== id) : [...f.canchas, id]
  }))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setConflictos([])
    setExito('')
    if (form.canchas.length === 0) return setError('Elige al menos una cancha')
    if (form.inscripcion_cierre >= form.fecha_inicio) return setError('Las inscripciones deben cerrar antes del día de inicio del torneo')
    if (form.inscripcion_cierre < form.inscripcion_apertura) return setError('El cierre de inscripciones no puede ser anterior a la apertura')

    setEnviando(true)
    try {
      const res = await createSolicitudApi(aPayload(form, Boolean(convenio)))
      setExito(res.data.message)
      setForm(f => ({ ...formInicial(user), empresa: f.empresa }))
      setCotizacion(null)
      await cargarSolicitudes()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo enviar la solicitud'))
      setConflictos(err.response?.data?.conflictos ?? [])
    } finally {
      setEnviando(false)
    }
  }

  const cancelar = async (s) => {
    setCancelando(s._id)
    try {
      await cancelarSolicitudApi(s._id)
      await cargarSolicitudes()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cancelar la solicitud'))
    } finally {
      setCancelando(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="organiza-torneo">
        <Modalidades />
        <div className="tournaments-empty">
          <i className="material-icons">business</i>
          <h5>Inicia sesión para solicitar tu torneo</h5>
          <p>Con tu cuenta puedes enviar la solicitud, ver el costo y seguir su estado.</p>
          <Link to="/login" state={{ from: location }} className="tournament-btn org-login-btn">
            <i className="material-icons">login</i> Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  const hoy = todayKey()

  return (
    <div className="organiza-torneo">
      <Modalidades />

      {exito && (
        <div className="org-alerta ok"><i className="material-icons">check_circle</i>{exito}</div>
      )}

      <div className="org-layout">
        <form className="org-form" onSubmit={enviar}>
          <fieldset>
            <legend><i className="material-icons">business</i> Empresa u organizador</legend>
            <div className="org-grid">
              <div className="tournament-form-field">
                <label>Nombre de la empresa *</label>
                <input className="browser-default" value={form.empresa.nombre} onChange={setEmpresa('nombre')} required />
              </div>
              <div className="tournament-form-field">
                <label>NIT (opcional)</label>
                <input className="browser-default" value={form.empresa.nit} onChange={setEmpresa('nit')} />
              </div>
              <div className="tournament-form-field">
                <label>Persona de contacto *</label>
                <input className="browser-default" value={form.empresa.contacto} onChange={setEmpresa('contacto')} required />
              </div>
              <div className="tournament-form-field">
                <label>Teléfono *</label>
                <input className="browser-default" type="tel" value={form.empresa.telefono} onChange={setEmpresa('telefono')} required />
              </div>
              <div className="tournament-form-field org-full">
                <label>Email de contacto *</label>
                <input className="browser-default" type="email" value={form.empresa.email} onChange={setEmpresa('email')} required />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend><i className="material-icons">emoji_events</i> Torneo</legend>
            <div className="org-grid">
              <div className="tournament-form-field org-full">
                <label>Nombre del torneo *</label>
                <input className="browser-default" value={form.nombre_torneo} onChange={set('nombre_torneo')} placeholder="Copa de integración 2026" required />
              </div>
              <div className="tournament-form-field">
                <label>Categoría</label>
                <select className="browser-default org-select" value={form.tipo_torneo} onChange={set('tipo_torneo')}>
                  <option value="Comunidad">Comunidad</option>
                  <option value="Amateur">Amateur</option>
                  <option value="Profesional">Profesional</option>
                </select>
              </div>
              <div className="tournament-form-field">
                <label>Cupo (parejas) *</label>
                <input className="browser-default" type="number" min="2" max="64" value={form.cupo_maximo_parejas} onChange={set('cupo_maximo_parejas')} required />
              </div>
              <div className="tournament-form-field">
                <label>Inscripción por jugador (COP)</label>
                <input className="browser-default" type="number" min="0" step="1000" value={form.precio_inscripcion} onChange={set('precio_inscripcion')} />
                <span className="tournament-form-hint">0 si la empresa asume la inscripción.</span>
              </div>
              <div className="tournament-form-field org-full">
                <label>Descripción (opcional)</label>
                <textarea className="org-textarea" rows="2" maxLength={500} value={form.descripcion} onChange={set('descripcion')} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend><i className="material-icons">schedule</i> Días y horario de juego</legend>
            <div className="org-grid">
              <div className="tournament-form-field">
                <label>Primer día *</label>
                <input className="browser-default" type="date" min={hoy} value={form.fecha_inicio} onChange={set('fecha_inicio')} required />
              </div>
              <div className="tournament-form-field">
                <label>Último día *</label>
                <input className="browser-default" type="date" min={form.fecha_inicio} value={form.fecha_fin} onChange={set('fecha_fin')} required />
              </div>
              <div className="tournament-form-field">
                <label>Desde *</label>
                <select className="browser-default org-select" value={form.hora_inicio} onChange={setHoraInicio}>
                  {HORAS.slice(0, -1).map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </div>
              <div className="tournament-form-field">
                <label>Hasta *</label>
                <select className="browser-default org-select" value={form.hora_fin} onChange={set('hora_fin')}>
                  {HORAS.filter(h => h > form.hora_inicio).map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </div>
              <div className="tournament-form-field org-full">
                <label>Duración de cada partido</label>
                <select className="browser-default org-select" value={form.duracion_partido_min} onChange={set('duracion_partido_min')}>
                  <option value={60}>60 minutos</option>
                  <option value={90}>90 minutos</option>
                  <option value={120}>120 minutos</option>
                </select>
              </div>
            </div>

            <label className="org-label">Canchas para el torneo *</label>
            <div className="org-canchas">
              {canchas.length === 0 && <p className="org-muted">No hay canchas disponibles.</p>}
              {canchas.map(c => {
                const elegida = form.canchas.includes(c._id)
                return (
                  <button
                    type="button"
                    key={c._id}
                    className={`org-cancha ${elegida ? 'elegida' : ''}`}
                    aria-pressed={elegida}
                    onClick={() => toggleCancha(c._id)}
                  >
                    <i className="material-icons">{elegida ? 'check_box' : 'check_box_outline_blank'}</i>
                    <span>
                      <strong>{c.nombre}</strong>
                      <small>{c.tipo}{c.techada ? ' · techada' : ''} · {formatPrice(c.precio_por_hora)}/hora</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend><i className="material-icons">how_to_reg</i> Periodo de inscripciones</legend>
            <div className="org-grid">
              <div className="tournament-form-field">
                <label>Abren el *</label>
                <input className="browser-default" type="date" min={hoy} value={form.inscripcion_apertura} onChange={set('inscripcion_apertura')} required />
              </div>
              <div className="tournament-form-field">
                <label>Cierran el *</label>
                <input className="browser-default"
                  type="date"
                  min={form.inscripcion_apertura}
                  max={form.fecha_inicio ? addDaysKey(form.fecha_inicio, -1) : undefined}
                  value={form.inscripcion_cierre}
                  onChange={set('inscripcion_cierre')}
                  required
                />
              </div>
            </div>
            <span className="tournament-form-hint">
              Las inscripciones deben cerrar antes del primer día: al cerrar se forman las parejas y se publica el horario de cada partido.
            </span>
          </fieldset>

          <fieldset>
            <legend><i className="material-icons">payments</i> Modalidad</legend>
            {convenio ? (
              <div className="org-alerta ok">
                <i className="material-icons">verified</i>
                Tu empresa tiene un convenio vigente hasta el {formatDateLong(convenio.vigente_hasta)}: el descuento se aplica automáticamente.
              </div>
            ) : (
              <>
                <div className="org-opciones">
                  <button type="button" className={`org-opcion ${form.modalidad === 'bloque' ? 'elegida' : ''}`} aria-pressed={form.modalidad === 'bloque'} onClick={() => setForm(f => ({ ...f, modalidad: 'bloque' }))}>
                    <i className="material-icons">date_range</i>
                    <strong>Alquiler por bloque</strong>
                    <small>Solo este torneo</small>
                  </button>
                  <button type="button" className={`org-opcion ${form.modalidad === 'convenio' ? 'elegida' : ''}`} aria-pressed={form.modalidad === 'convenio'} onClick={() => setForm(f => ({ ...f, modalidad: 'convenio' }))}>
                    <i className="material-icons">handshake</i>
                    <strong>Convenio empresarial</strong>
                    <small>Descuento por varios meses</small>
                  </button>
                </div>
                {form.modalidad === 'convenio' && (
                  <div className="org-opciones meses">
                    {CONVENIOS.map(c => (
                      <button
                        type="button"
                        key={c.meses}
                        className={`org-opcion ${Number(form.convenio_meses) === c.meses ? 'elegida' : ''}`}
                        aria-pressed={Number(form.convenio_meses) === c.meses}
                        onClick={() => setForm(f => ({ ...f, convenio_meses: c.meses }))}
                      >
                        <strong>{c.meses} meses</strong>
                        <small>{c.pct} % de descuento</small>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </fieldset>

          {error && (
            <div className="tournament-form-error">
              <i className="material-icons">error_outline</i>
              {error}
            </div>
          )}
          {conflictos.length > 0 && (
            <ul className="org-conflictos-lista">
              {conflictos.slice(0, 6).map((c, i) => (
                <li key={i}>{formatDateShort(c.fecha)} · {formatHour(c.hora_inicio)}–{formatHour(c.hora_fin)} · {c.cancha} ({c.detalle})</li>
              ))}
            </ul>
          )}

          <button type="submit" className="tournament-btn" disabled={enviando}>
            <i className={`material-icons ${enviando ? 'spinning' : ''}`}>{enviando ? 'refresh' : 'send'}</i>
            {enviando ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>

        <aside className="org-aside">
          <Cotizacion
            cotizacion={listo ? cotizacion : null}
            error={listo ? cotizacionError : ''}
            cargando={listo && cotizando}
            conConvenio={Boolean(convenio)}
          />
        </aside>
      </div>

      <MisSolicitudes solicitudes={solicitudes} onCancelar={cancelar} cancelando={cancelando} onVerTorneos={onVerTorneos} />
    </div>
  )
}

export default OrganizaTorneo
