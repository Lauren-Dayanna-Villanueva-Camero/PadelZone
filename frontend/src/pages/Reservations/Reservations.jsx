import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getCanchasApi,
  getHorariosOcupadosApi,
  createReservaApi,
  getErrorMessage
} from '../../services/api'
import { getCourtImage, formatPrice, todayKey } from '../../utils/helpers'
import './Reservations.css'

const hours = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]

const formatHour = (h) => {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 12 ? 12 : h
  return `${display}:00 ${suffix}`
}

const toHHmm = (h) => `${String(h).padStart(2, '0')}:00`
const toHour = (hhmm) => parseInt(hhmm.split(':')[0])

const emptyForm = { court: '', date: '', startHour: '', endHour: '' }

function Reservations() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [courts, setCourts] = useState([])
  const [courtsLoading, setCourtsLoading] = useState(true)
  const [courtsError, setCourtsError] = useState('')

  const [form, setForm] = useState(emptyForm)
  const [occupied, setOccupied] = useState({ key: '', ranges: [] })
  const [reloadOccupied, setReloadOccupied] = useState(0)

  const [showCourtModal, setShowCourtModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [savedReservation, setSavedReservation] = useState(null)

  // Canchas desde el backend
  useEffect(() => {
    let cancelled = false
    getCanchasApi()
      .then(res => { if (!cancelled) setCourts(res.data) })
      .catch(err => { if (!cancelled) setCourtsError(getErrorMessage(err, 'No se pudieron cargar las canchas')) })
      .finally(() => { if (!cancelled) setCourtsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Cancha preseleccionada desde ?court=<id> (enlaces de las tarjetas de canchas);
  // se sigue aceptando el nombre por compatibilidad con enlaces anteriores
  const courtParam = searchParams.get('court')
  const courtFromParam = courtParam
    ? courts.find(c => c._id === courtParam || c.nombre === courtParam || `Cancha ${c.nombre}` === courtParam)
    : null
  const courtId = form.court || courtFromParam?._id || ''
  const selectedCourt = courts.find(c => c._id === courtId)

  // Horarios ocupados de la cancha y fecha elegidas
  const occupiedKey = courtId && form.date ? `${courtId}|${form.date}` : ''
  useEffect(() => {
    if (!occupiedKey) return
    let cancelled = false
    const [id, date] = occupiedKey.split('|')
    getHorariosOcupadosApi(id, date)
      .then(res => { if (!cancelled) setOccupied({ key: occupiedKey, ranges: res.data }) })
      .catch(() => { if (!cancelled) setOccupied({ key: occupiedKey, ranges: [] }) })
    return () => { cancelled = true }
  }, [occupiedKey, reloadOccupied])

  const ranges = occupied.key === occupiedKey ? occupied.ranges : []
  const loadingOccupied = !!occupiedKey && occupied.key !== occupiedKey

  // Una hora está ocupada si cae dentro de algún rango reservado
  const isHourTaken = (h) =>
    ranges.some(r => toHour(r.hora_inicio) <= h && h < toHour(r.hora_fin))

  // Si la fecha es hoy, no se ofrecen horas que ya pasaron
  const isToday = form.date === todayKey()
  const currentHour = new Date().getHours()
  const startHours = hours.slice(0, -1).filter(h =>
    !isHourTaken(h) && !(isToday && h <= currentHour)
  )

  // La hora de fin no puede atravesar la siguiente reserva
  const start = form.startHour ? parseInt(form.startHour) : null
  const nextTakenStart = start === null
    ? null
    : ranges.map(r => toHour(r.hora_inicio)).filter(h => h > start).sort((a, b) => a - b)[0]
  const endHours = start === null
    ? []
    : hours.filter(h => h > start && (nextTakenStart === undefined || h <= nextTakenStart))

  const duration = form.startHour && form.endHour
    ? parseInt(form.endHour) - parseInt(form.startHour)
    : 0

  const total = selectedCourt ? selectedCourt.precio_por_hora * duration : 0

  const handleChange = (e) => {
    const { name, value } = e.target
    setSubmitError('')
    if (name === 'startHour') {
      setForm(prev => ({ ...prev, startHour: value, endHour: '' }))
    } else if (name === 'date') {
      setForm(prev => ({ ...prev, court: courtId, date: value, startHour: '', endHour: '' }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectCourt = (court) => {
    setForm(prev => ({ ...prev, court: court._id, startHour: '', endHour: '' }))
    setSubmitError('')
    setShowCourtModal(false)
  }

  const handleSubmit = async () => {
    if (!courtId || !form.date || !form.startHour || !form.endHour) {
      setSubmitError('Por favor completa todos los campos.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await createReservaApi({
        cancha_id: courtId,
        fecha: form.date,
        hora_inicio: toHHmm(parseInt(form.startHour)),
        hora_fin: toHHmm(parseInt(form.endHour))
      })
      setSavedReservation(res.data.reserva)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo crear la reserva.'))
      // Refresca los horarios: puede que alguien haya reservado ese horario mientras tanto
      setOccupied({ key: '', ranges: [] })
      setReloadOccupied(n => n + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setForm(emptyForm)
    setOccupied({ key: '', ranges: [] })
    setSavedReservation(null)
  }

  return (
    <div className="reservations-page">

      <div className="reservations-header">
        <div className="container">
          <h1>Reservar Cancha</h1>
          <p>Completa el formulario y asegura tu horario preferido</p>
        </div>
      </div>

      <div className="container reservations-body">
        <div className="reservations-grid">

          {/* Formulario */}
          <div className="res-form-card">
            <div className="res-section">
              <h5>Información de Reserva</h5>
              <p className="res-subtitle">Selecciona la cancha, fecha y horario para tu reserva</p>

              {courtsError && (
                <div className="res-error" role="alert">
                  <i className="material-icons">error_outline</i>
                  {courtsError}
                </div>
              )}

              {/* Botón selector de cancha */}
              <div className="res-field full">
                <label>Cancha</label>
                <button
                  type="button"
                  className={`res-court-selector-btn ${selectedCourt ? 'selected' : ''}`}
                  onClick={() => setShowCourtModal(true)}
                  disabled={courtsLoading || courts.length === 0}
                >
                  {selectedCourt ? (
                    <>
                      <img src={getCourtImage(selectedCourt)} alt={selectedCourt.nombre} />
                      <div className="res-court-selector-info">
                        <span className="res-court-selector-name">{selectedCourt.nombre}</span>
                        <span className="res-court-selector-sub">
                          {selectedCourt.tipo} · {formatPrice(selectedCourt.precio_por_hora)}/hora
                        </span>
                      </div>
                      <i className="material-icons res-court-selector-change">edit</i>
                    </>
                  ) : (
                    <>
                      <div className="res-court-selector-placeholder">
                        <i className="material-icons">sports_tennis</i>
                      </div>
                      <span className="res-court-selector-text">
                        {courtsLoading
                          ? 'Cargando canchas...'
                          : courts.length === 0 ? 'No hay canchas disponibles' : 'Ver y elegir cancha'}
                      </span>
                      <i className="material-icons">chevron_right</i>
                    </>
                  )}
                </button>
              </div>

              {/* Preview grande */}
              {selectedCourt && (
                <div className="res-court-preview-large">
                  <img src={getCourtImage(selectedCourt)} alt={selectedCourt.nombre} />
                  <div className="res-court-preview-overlay">
                    <div className="res-court-preview-badge">
                      <i className="material-icons">
                        {selectedCourt.tipo === 'Interior' ? 'home' : 'wb_sunny'}
                      </i>
                      {selectedCourt.tipo}
                    </div>
                    <div className="res-court-preview-text">
                      <h6>{selectedCourt.nombre}</h6>
                      <p>{selectedCourt.caracteristicas?.join(' · ')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fecha */}
              <div className="res-field full" style={{ marginTop: '20px' }}>
                <label>Fecha</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  min={todayKey()}
                  onChange={handleChange}
                />
              </div>

              {/* Rango de horas */}
              <div className="res-row">
                <div className="res-field">
                  <label>Hora de inicio</label>
                  <div className="res-select-wrapper">
                    <select
                      name="startHour"
                      value={form.startHour}
                      onChange={handleChange}
                      disabled={!selectedCourt || !form.date || loadingOccupied}
                    >
                      <option value="">{loadingOccupied ? 'Cargando...' : 'Desde'}</option>
                      {startHours.map(h => (
                        <option key={h} value={h}>{formatHour(h)}</option>
                      ))}
                    </select>
                    <i className="material-icons">expand_more</i>
                  </div>
                </div>

                <div className="res-field">
                  <label>Hora de fin</label>
                  <div className="res-select-wrapper">
                    <select
                      name="endHour"
                      value={form.endHour}
                      onChange={handleChange}
                      disabled={!form.startHour}
                    >
                      <option value="">Hasta</option>
                      {endHours.map(h => (
                        <option key={h} value={h}>
                          {formatHour(h)} ({h - parseInt(form.startHour)}h)
                        </option>
                      ))}
                    </select>
                    <i className="material-icons">expand_more</i>
                  </div>
                </div>
              </div>

              {selectedCourt && form.date && !loadingOccupied && startHours.length === 0 && (
                <p className="res-subtitle">No quedan horarios disponibles para esta fecha.</p>
              )}

              {duration > 0 && (
                <div className="res-duration-badge">
                  <i className="material-icons">timer</i>
                  {duration} hora{duration > 1 ? 's' : ''} de reserva
                  — Total: {formatPrice(total)}
                </div>
              )}
            </div>

            <hr className="res-divider" />

            <div className="res-section">
              <h5>Reservando como</h5>
              <p className="res-subtitle">
                {user?.nombre} {user?.apellido} · {user?.email}
                {' '}(<Link to="/perfil">ver perfil</Link>)
              </p>
            </div>

            {submitError && (
              <div className="res-error" role="alert">
                <i className="material-icons">error_outline</i>
                {submitError}
              </div>
            )}

            <button
              type="button"
              className="res-btn-confirm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              <i className={`material-icons ${submitting ? 'spinning' : ''}`}>
                {submitting ? 'refresh' : 'check'}
              </i>
              {submitting ? 'Reservando...' : 'Confirmar Reserva'}
            </button>
          </div>

          {/* Resumen */}
          <div className="res-summary-card">
            <h5>Resumen de Reserva</h5>
            <div className="res-summary-rows">
              <div className="res-summary-row">
                <span>Cancha</span>
                <span>{selectedCourt ? selectedCourt.nombre : '—'}</span>
              </div>
              <div className="res-summary-row">
                <span>Fecha</span>
                <span>{form.date || '—'}</span>
              </div>
              <div className="res-summary-row">
                <span>Desde</span>
                <span>{form.startHour ? formatHour(parseInt(form.startHour)) : '—'}</span>
              </div>
              <div className="res-summary-row">
                <span>Hasta</span>
                <span>{form.endHour ? formatHour(parseInt(form.endHour)) : '—'}</span>
              </div>
              <div className="res-summary-row">
                <span>Duración</span>
                <span>{duration > 0 ? `${duration}h` : '—'}</span>
              </div>
            </div>

            <div className="res-summary-total">
              <span>Total</span>
              <span className="res-total-price">{formatPrice(total)}</span>
            </div>

            <div className="res-policies">
              <p><strong>Políticas de Reserva</strong></p>
              <ul>
                <li>Cancelación gratuita hasta 24h antes</li>
                <li>Llega 10 minutos antes de tu reserva</li>
                <li>Equipamiento básico incluido</li>
                <li>Mínimo 1 hora de reserva</li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* Modal selector de canchas */}
      {showCourtModal && (
        <div className="court-modal-overlay" onClick={() => setShowCourtModal(false)}>
          <div className="court-modal" onClick={e => e.stopPropagation()}>

            <div className="court-modal-header">
              <h5>Selecciona tu Cancha</h5>
              <button className="court-modal-close" onClick={() => setShowCourtModal(false)}>
                <i className="material-icons">close</i>
              </button>
            </div>

            <div className="court-modal-grid">
              {courts.map(court => (
                <div
                  key={court._id}
                  className={`court-modal-card ${courtId === court._id ? 'active' : ''}`}
                  onClick={() => handleSelectCourt(court)}
                >
                  <div className="court-modal-img">
                    <img src={getCourtImage(court)} alt={court.nombre} />
                    <span className="court-modal-badge">
                      <i className="material-icons">
                        {court.tipo === 'Interior' ? 'home' : 'wb_sunny'}
                      </i>
                      {court.tipo}
                    </span>
                    {courtId === court._id && (
                      <div className="court-modal-selected-check">
                        <i className="material-icons">check_circle</i>
                      </div>
                    )}
                  </div>
                  <div className="court-modal-info">
                    <div className="court-modal-title-row">
                      <span className="court-modal-name">{court.nombre}</span>
                      <span className="court-modal-price">{formatPrice(court.precio_por_hora)}/h</span>
                    </div>
                    <p className="court-modal-desc">{court.caracteristicas?.join(' · ')}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Modal confirmación */}
      {savedReservation && (
        <div className="res-modal-overlay" onClick={handleClose}>
          <div className="res-modal" onClick={e => e.stopPropagation()}>
            <div className="res-modal-icon">
              <i className="material-icons">check_circle</i>
            </div>
            <h4>¡Reserva Confirmada!</h4>
            <p>Tu reserva ha sido registrada exitosamente.</p>
            <div className="res-modal-details">
              <p><strong>Cancha:</strong> {savedReservation.cancha_id?.nombre}</p>
              <p><strong>Fecha:</strong> {String(savedReservation.fecha).slice(0, 10)}</p>
              <p><strong>Horario:</strong> {savedReservation.hora_inicio} – {savedReservation.hora_fin}</p>
              <p><strong>Total:</strong> {formatPrice(savedReservation.precio)}</p>
            </div>
            <button className="res-modal-btn" onClick={handleClose}>Cerrar</button>
          </div>
        </div>
      )}

    </div>
  )
}

export default Reservations
