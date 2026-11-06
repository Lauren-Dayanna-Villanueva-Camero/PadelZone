import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getTorneosApi,
  getMisInscripcionesApi,
  inscribirTorneoApi,
  cancelarInscripcionApi,
  getErrorMessage
} from '../../services/api'
import { getTournamentImage, formatDateLong, formatPrice, toDateKey, todayKey } from '../../utils/helpers'
import Cuadro from '../../components/Cuadro/Cuadro'
import './Tournaments.css'

const categoryColors = {
  'Profesional': '#1565c0',
  'Amateur': '#00897b',
  'Comunidad': '#6a1b9a'
}

const formatCard = (val) =>
  val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()

const formatExpiry = (val) =>
  val.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')

const emptyPayment = { card: '', holder: '', expiry: '', cvv: '' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const estadoBadges = {
  activo: { label: 'Inscripciones abiertas', icon: 'how_to_reg' },
  en_curso: { label: 'En curso', icon: 'sports_tennis' },
  finalizado: { label: 'Finalizado', icon: 'flag' },
  cancelado: { label: 'Cancelado', icon: 'cancel' }
}

// El backend marca como 'finalizado' los torneos vencidos al consultarlos; esta
// comprobación cubre la página abierta desde antes de que terminara el torneo
const estadoDe = (t) =>
  t.estado !== 'cancelado' && toDateKey(t.fecha_fin) < todayKey() ? 'finalizado' : t.estado

function EstadoBadge({ torneo, className = '' }) {
  const estado = estadoDe(torneo)
  const badge = estadoBadges[estado] || estadoBadges.activo
  return (
    <span className={`tournament-state-badge ${estado} ${className}`}>
      <i className="material-icons">{badge.icon}</i>
      {badge.label}
    </span>
  )
}

// Con quién juega el usuario; las parejas solo se conocen al cerrar inscripciones
function TuEquipo({ reg }) {
  const estado = estadoDe(reg.torneo_id)
  if (estado === 'cancelado') return null

  if (estado === 'activo') {
    return (
      <div className="tournament-team pending">
        <i className="material-icons">schedule</i>
        <div>
          <span className="tournament-team-title">Tu equipo</span>
          <span>Las parejas se publicarán al cerrar las inscripciones</span>
          {reg.pareja_usuario_id && (
            <span className="tournament-team-note">
              Pareja indicada: {reg.pareja_usuario_id.nombre} {reg.pareja_usuario_id.apellido}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (reg.equipo == null) {
    return (
      <div className="tournament-team alone">
        <i className="material-icons">person_off</i>
        <div>
          <span className="tournament-team-title">Tu equipo</span>
          <span>Quedaste sin pareja asignada. El organizador se pondrá en contacto contigo.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="tournament-team">
      <i className="material-icons">groups</i>
      <div>
        <span className="tournament-team-title">Tu equipo · #{reg.equipo}</span>
        <span>
          Juegas con <strong>{reg.companero ? `${reg.companero.nombre} ${reg.companero.apellido}` : 'tu pareja'}</strong>
        </span>
        {reg.companero?.email && <span className="tournament-team-note">{reg.companero.email}</span>}
      </div>
    </div>
  )
}

function Tournaments() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [registrations, setRegistrations] = useState([])

  const [selectedTournament, setSelectedTournament] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  // Torneo abierto desde "Mis inscripciones" (id) y su subpestaña: 'equipo' | 'cuadro'
  const [vistaTorneo, setVistaTorneo] = useState(null)
  const [subTab, setSubTab] = useState('cuadro')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelError, setCancelError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successText, setSuccessText] = useState('')

  const [payment, setPayment] = useState(emptyPayment)
  const [parejaEmail, setParejaEmail] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paying, setPaying] = useState(false)

  const loadTournaments = useCallback(async (isCancelled = () => false) => {
    try {
      const res = await getTorneosApi()
      if (!isCancelled()) setTournaments(res.data)
    } catch (err) {
      if (!isCancelled()) setLoadError(getErrorMessage(err, 'No se pudieron cargar los torneos'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [])

  const loadRegistrations = useCallback(async (isCancelled = () => false) => {
    try {
      const res = await getMisInscripcionesApi()
      // Si el torneo fue borrado de la base de datos, torneo_id llega en null
      if (!isCancelled()) setRegistrations(res.data.filter(r => r.torneo_id))
    } catch {
      if (!isCancelled()) setRegistrations([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    loadTournaments(() => cancelled)
    return () => { cancelled = true }
  }, [loadTournaments])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al iniciar sesión
    loadRegistrations(() => cancelled)
    return () => { cancelled = true }
  }, [isAuthenticated, loadRegistrations])

  // Sin sesión no hay inscripciones que mostrar
  const myRegistrations = isAuthenticated ? registrations : []
  const registrationFor = (tournamentId) =>
    myRegistrations.find(r => r.torneo_id._id === tournamentId)
  const regEnVista = vistaTorneo ? registrationFor(vistaTorneo) : null

  const abrirCuadro = (reg) => {
    setVistaTorneo(reg.torneo_id._id)
    setSubTab('cuadro')
  }

  const cambiarTab = (tab) => {
    setActiveTab(tab)
    setVistaTorneo(null)
  }

  const isFinished = (t) => estadoDe(t) === 'finalizado'
  // Se listan los torneos con inscripciones abiertas y los que se están jugando
  const openTournaments = tournaments.filter(t => ['activo', 'en_curso'].includes(estadoDe(t)))

  // Los cupos son de parejas, pero un jugador suelto deja media pareja libre:
  // jugadores_libres (del backend) cuenta plazas individuales
  const playersLeft = (t) => t.jugadores_libres ??
    Math.max(t.cupo_maximo_parejas - (t.parejas_inscritas || 0), 0) * 2
  const spotsLeft = (t) => Math.floor(playersLeft(t) / 2)
  const halfSpot = (t) => playersLeft(t) % 2 === 1
  // En la tarjeta: "2½"; en el formulario se explica qué es la media pareja
  const spotsShort = (t) => `${spotsLeft(t)}${halfSpot(t) ? '½' : ''}`
  const spotsLabel = (t) => halfSpot(t)
    ? `${spotsLeft(t)} parejas + 1 lugar para jugador sin pareja`
    : String(spotsLeft(t))
  const spotsPercent = (t) =>
    Math.min(((t.parejas_inscritas || 0) / t.cupo_maximo_parejas) * 100, 100)

  const handleOpenModal = (tournament) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } })
      return
    }
    if (estadoDe(tournament) !== 'activo') {
      loadTournaments()
      return
    }
    setSelectedTournament(tournament)
    setPayment(emptyPayment)
    setParejaEmail('')
    setPaymentError('')
  }

  const handleCloseModal = () => {
    if (paying) return
    setSelectedTournament(null)
  }

  // El pago es simulado (no hay pasarela); la inscripción sí se guarda en el backend
  const handlePayment = async () => {
    if (isFinished(selectedTournament)) {
      setPaymentError('Este torneo ya terminó, no se aceptan más inscripciones.')
      return
    }
    const email = parejaEmail.trim().toLowerCase()
    if (email && !EMAIL_RE.test(email)) {
      setPaymentError('El email de tu pareja no es válido.')
      return
    }
    if (email && playersLeft(selectedTournament) < 2) {
      setPaymentError('Solo queda lugar para un jugador sin pareja: inscríbete sin indicar pareja.')
      return
    }
    const rawCard = payment.card.replace(/\s/g, '')
    if (rawCard.length < 16 || !payment.holder || !payment.expiry || payment.cvv.length < 3) {
      setPaymentError('Por favor completa todos los datos de pago.')
      return
    }
    setPaymentError('')
    setPaying(true)

    try {
      const res = await inscribirTorneoApi(selectedTournament._id, email ? { pareja_email: email } : {})
      setSuccessText(res.data.inscripciones_cerradas
        ? '¡Inscripción confirmada! Se completaron los cupos y ya se organizaron las parejas.'
        : '¡Inscripción confirmada exitosamente!')
      await Promise.all([loadTournaments(), loadRegistrations()])
      setSelectedTournament(null)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3500)
    } catch (err) {
      setPaymentError(getErrorMessage(err, 'No se pudo completar la inscripción.'))
    } finally {
      setPaying(false)
    }
  }

  const handleCancelRegistration = async (tournamentId) => {
    setCancelError('')
    try {
      await cancelarInscripcionApi(tournamentId)
      setCancelTarget(null)
      await Promise.all([loadTournaments(), loadRegistrations()])
    } catch (err) {
      setCancelError(getErrorMessage(err, 'No se pudo cancelar la inscripción.'))
    }
  }

  return (
    <div className="tournaments-page">

      <div className="tournaments-header">
        <div className="container">
          <h1>Torneos y Competiciones</h1>
          <p>Participa en nuestros torneos y demuestra tu nivel en la cancha</p>
        </div>
      </div>

      <div className="container tournaments-body">

        {isAuthenticated && (
          <div className="tournaments-tabs">
            <button
              className={`tournaments-tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => cambiarTab('active')}
            >
              <i className="material-icons">emoji_events</i>
              Torneos Disponibles
            </button>
            <button
              className={`tournaments-tab ${activeTab === 'mine' ? 'active' : ''}`}
              onClick={() => cambiarTab('mine')}
            >
              <i className="material-icons">how_to_reg</i>
              Mis Inscripciones
              {myRegistrations.length > 0 && (
                <span className="tab-count">{myRegistrations.length}</span>
              )}
            </button>
          </div>
        )}

        {activeTab === 'active' && (
          loading ? (
            <div className="tournaments-empty">
              <i className="material-icons spinning">refresh</i>
              <p>Cargando torneos...</p>
            </div>
          ) : loadError ? (
            <div className="tournaments-empty">
              <i className="material-icons">error_outline</i>
              <h5>{loadError}</h5>
            </div>
          ) : openTournaments.length === 0 ? (
            <div className="tournaments-empty">
              <i className="material-icons">emoji_events</i>
              <h5>No hay torneos abiertos ni en curso por ahora</h5>
            </div>
          ) : (
            <div className="tournaments-grid">
              {openTournaments.map(tournament => {
                const full = playersLeft(tournament) === 0
                const registration = registrationFor(tournament._id)
                const registered = Boolean(registration)
                const abierto = estadoDe(tournament) === 'activo'
                return (
                  <div className="tournament-card" key={tournament._id}>
                    <div className="tournament-img-wrapper">
                      <img src={getTournamentImage(tournament)} alt={tournament.nombre} />
                      <span
                        className="tournament-category-badge"
                        style={{ backgroundColor: categoryColors[tournament.tipo_torneo] }}
                      >
                        {tournament.tipo_torneo}
                      </span>
                      <EstadoBadge torneo={tournament} className="on-image" />
                      {registered && (
                        <div className="tournament-registered-badge">
                          <i className="material-icons">check_circle</i>
                          Inscrito
                        </div>
                      )}
                    </div>

                    <div className="tournament-info">
                      <div className="tournament-title-row">
                        <h5>{tournament.nombre}</h5>
                        <span className="tournament-fee">{formatPrice(tournament.precio_inscripcion)}</span>
                      </div>

                      <div className="tournament-details">
                        <div className="tournament-detail">
                          <i className="material-icons">calendar_today</i>
                          <span>
                            {formatDateLong(tournament.fecha_inicio)} – {formatDateLong(tournament.fecha_fin)}
                          </span>
                        </div>
                        <div className="tournament-detail">
                          <i className="material-icons">group</i>
                          <span>Hasta {tournament.cupo_maximo_parejas} parejas</span>
                        </div>
                      </div>

                      <div className="tournament-spots">
                        <div className="tournament-spots-header">
                          <span>Cupos disponibles</span>
                          <span
                            className="spots-count"
                            title={halfSpot(tournament) ? 'Hay un jugador inscrito sin pareja: queda lugar para uno más' : undefined}
                          >
                            {spotsShort(tournament)} / {tournament.cupo_maximo_parejas}
                          </span>
                        </div>
                        <div className="tournament-progress">
                          <div
                            className="tournament-progress-bar"
                            style={{ width: `${spotsPercent(tournament)}%` }}
                          />
                        </div>
                      </div>

                      {registered && <TuEquipo reg={registration} />}

                      {registered ? (
                        <button className="tournament-btn-registered" disabled>
                          <i className="material-icons">check</i>
                          Ya estás inscrito
                        </button>
                      ) : !abierto ? (
                        <button className="tournament-btn-full" disabled>
                          <i className="material-icons">lock</i>
                          Inscripciones cerradas
                        </button>
                      ) : full ? (
                        <button className="tournament-btn-full" disabled>
                          <i className="material-icons">block</i>
                          Cupos agotados
                        </button>
                      ) : (
                        <button
                          className="tournament-btn"
                          onClick={() => handleOpenModal(tournament)}
                        >
                          <i className="material-icons">how_to_reg</i>
                          {isAuthenticated
                            ? `Inscribirme — ${formatPrice(tournament.precio_inscripcion)}`
                            : 'Inicia sesión para inscribirte'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'mine' && regEnVista && (
          <div className="tournament-view">
            <button className="tournament-view-back" onClick={() => setVistaTorneo(null)}>
              <i className="material-icons">arrow_back</i>
              Mis inscripciones
            </button>

            <div className="tournament-view-head">
              <div>
                <h4>{regEnVista.torneo_id.nombre}</h4>
                <span className="tournament-view-dates">
                  <i className="material-icons">calendar_today</i>
                  {formatDateLong(regEnVista.torneo_id.fecha_inicio)} – {formatDateLong(regEnVista.torneo_id.fecha_fin)}
                </span>
              </div>
              <EstadoBadge torneo={regEnVista.torneo_id} />
            </div>

            <div className="tournament-subtabs" role="tablist">
              <button
                role="tab"
                aria-selected={subTab === 'equipo'}
                className={`tournament-subtab ${subTab === 'equipo' ? 'active' : ''}`}
                onClick={() => setSubTab('equipo')}
              >
                <i className="material-icons">groups</i>
                Mi equipo
              </button>
              <button
                role="tab"
                aria-selected={subTab === 'cuadro'}
                className={`tournament-subtab ${subTab === 'cuadro' ? 'active' : ''}`}
                onClick={() => setSubTab('cuadro')}
              >
                <i className="material-icons">account_tree</i>
                Cuadro
              </button>
            </div>

            <div className="tournament-view-body">
              {subTab === 'equipo' ? (
                <TuEquipo reg={regEnVista} />
              ) : (
                <Cuadro torneoId={regEnVista.torneo_id._id} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'mine' && !regEnVista && (
          <div className="my-registrations">
            {myRegistrations.length === 0 ? (
              <div className="tournaments-empty">
                <i className="material-icons">emoji_events</i>
                <h5>No tienes inscripciones aún</h5>
                <p>Explora los torneos disponibles y participa</p>
                <button className="tournament-btn" onClick={() => cambiarTab('active')}>
                  Ver Torneos
                </button>
              </div>
            ) : (
              <div className="my-registrations-grid">
                {myRegistrations.map(reg => {
                  const t = reg.torneo_id
                  return (
                    <div className="my-reg-card" key={reg._id}>
                      <div className="my-reg-header"
                        style={{ backgroundColor: categoryColors[t.tipo_torneo] || '#010231' }}
                      >
                        <i className="material-icons">emoji_events</i>
                        <span>{t.tipo_torneo}</span>
                        <EstadoBadge torneo={t} className="on-header" />
                      </div>
                      <div className="my-reg-body">
                        <h6>{t.nombre}</h6>
                        <div className="my-reg-detail">
                          <i className="material-icons">calendar_today</i>
                          <span>{formatDateLong(t.fecha_inicio)} – {formatDateLong(t.fecha_fin)}</span>
                        </div>
                        <div className="my-reg-detail">
                          <i className="material-icons">payments</i>
                          <span>Inscripción: {formatPrice(t.precio_inscripcion)}</span>
                        </div>
                        <div className="my-reg-detail">
                          <i className="material-icons">event</i>
                          <span>
                            {reg.inscrito_por_pareja
                              ? `Te inscribió ${reg.pareja_usuario_id?.nombre ?? 'tu pareja'} el ${formatDateLong(reg.fecha_inscripcion)}`
                              : `Inscrito el ${formatDateLong(reg.fecha_inscripcion)}`}
                          </span>
                        </div>
                        <TuEquipo reg={reg} />

                        <div className="my-reg-footer">
                          <span className="my-reg-status">
                            <i className="material-icons">
                              {t.estado === 'cancelado' ? 'cancel' : 'check_circle'}
                            </i>
                            {t.estado === 'cancelado'
                              ? 'Torneo cancelado'
                              : isFinished(t)
                                ? 'Torneo finalizado'
                                : reg.pago_confirmado ? 'Pago confirmado' : 'Pago pendiente'}
                          </span>
                          {t.estado !== 'cancelado' && (
                            <button className="my-reg-bracket-btn" onClick={() => abrirCuadro(reg)}>
                              <i className="material-icons">account_tree</i>
                              Ver cuadro
                            </button>
                          )}
                          {/* Cancelar solo mientras las inscripciones siguen abiertas */}
                          {estadoDe(t) === 'activo' && !reg.inscrito_por_pareja && (
                            <button
                              className="my-reg-cancel-btn"
                              onClick={() => { setCancelError(''); setCancelTarget(t._id) }}
                            >
                              <i className="material-icons">cancel</i>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {selectedTournament && (
        <div className="tournament-modal-overlay" onClick={handleCloseModal}>
          <div className="tournament-modal" onClick={e => e.stopPropagation()}>

            <div className="tournament-modal-header">
              <div className="tournament-modal-steps">
                <span className="modal-step active">
                  <i className="material-icons">credit_card</i>
                  Pago de inscripción
                </span>
              </div>
              <button className="tournament-modal-close" onClick={handleCloseModal}>
                <i className="material-icons">close</i>
              </button>
            </div>

            <div className="tournament-modal-body">
              <h6 className="modal-section-title">Inscripción — {selectedTournament.nombre}</h6>

              <div className="payment-summary">
                <div className="payment-summary-row">
                  <span>Torneo</span>
                  <span>{selectedTournament.nombre}</span>
                </div>
                <div className="payment-summary-row">
                  <span>Fecha</span>
                  <span>{formatDateLong(selectedTournament.fecha_inicio)}</span>
                </div>
                <div className="payment-summary-row">
                  <span>Cupos disponibles</span>
                  <span>{spotsLabel(selectedTournament)}</span>
                </div>
                <div className="payment-summary-row total">
                  <span>Total a pagar</span>
                  <span>{formatPrice(selectedTournament.precio_inscripcion)}</span>
                </div>
              </div>

              {paymentError && (
                <div className="tournament-form-error">
                  <i className="material-icons">error_outline</i>
                  {paymentError}
                </div>
              )}

              <div className="tournament-form-field">
                <label>Email de tu pareja (opcional)</label>
                <input
                  type="email"
                  placeholder="pareja@correo.com"
                  value={parejaEmail}
                  onChange={e => setParejaEmail(e.target.value)}
                  autoComplete="off"
                />
                <span className="tournament-form-hint">
                  Debe tener cuenta en PadelZone. Si lo dejas vacío, te asignaremos pareja al cerrar las inscripciones.
                </span>
              </div>

              <div className="credit-card-preview">
                <div className="credit-card-chip">
                  <i className="material-icons">contactless</i>
                </div>
                <div className="credit-card-number">
                  {payment.card || '•••• •••• •••• ••••'}
                </div>
                <div className="credit-card-bottom">
                  <div>
                    <p className="credit-card-label">Titular</p>
                    <p className="credit-card-value">
                      {payment.holder || 'NOMBRE APELLIDO'}
                    </p>
                  </div>
                  <div>
                    <p className="credit-card-label">Vence</p>
                    <p className="credit-card-value">{payment.expiry || 'MM/AA'}</p>
                  </div>
                </div>
              </div>

              <div className="tournament-form-field">
                <label>Número de tarjeta</label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={payment.card}
                  maxLength={19}
                  onChange={e => setPayment(p => ({ ...p, card: formatCard(e.target.value) }))}
                />
              </div>

              <div className="tournament-form-field">
                <label>Nombre del titular</label>
                <input
                  type="text"
                  placeholder="Como aparece en la tarjeta"
                  value={payment.holder}
                  onChange={e => setPayment(p => ({ ...p, holder: e.target.value.toUpperCase() }))}
                />
              </div>

              <div className="payment-row">
                <div className="tournament-form-field">
                  <label>Fecha de vencimiento</label>
                  <input
                    type="text"
                    placeholder="MM/AA"
                    value={payment.expiry}
                    maxLength={5}
                    onChange={e => setPayment(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                  />
                </div>
                <div className="tournament-form-field">
                  <label>CVV</label>
                  <input
                    type="password"
                    placeholder="•••"
                    value={payment.cvv}
                    maxLength={4}
                    onChange={e => setPayment(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '') }))}
                  />
                </div>
              </div>

              <p className="payment-disclaimer">
                <i className="material-icons">lock</i>
                Pago simulado — ningún dato de tarjeta se envía ni se guarda
              </p>

              <div className="payment-actions">
                <button className="payment-back-btn" onClick={handleCloseModal} disabled={paying}>
                  <i className="material-icons">arrow_back</i>
                  Cancelar
                </button>
                <button className="tournament-modal-btn" onClick={handlePayment} disabled={paying}>
                  {paying ? (
                    <>
                      <i className="material-icons spinning">refresh</i>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <i className="material-icons">payment</i>
                      Pagar {formatPrice(selectedTournament.precio_inscripcion)}
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="tournament-modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="cancel-modal-icon">
              <i className="material-icons">warning</i>
            </div>
            <h5>¿Cancelar inscripción?</h5>
            <p>Esta acción no se puede deshacer y perderás tu cupo.</p>
            {cancelError && (
              <div className="tournament-form-error">
                <i className="material-icons">error_outline</i>
                {cancelError}
              </div>
            )}
            <div className="cancel-modal-actions">
              <button
                className="cancel-modal-confirm"
                onClick={() => handleCancelRegistration(cancelTarget)}
              >
                Sí, cancelar
              </button>
              <button
                className="cancel-modal-dismiss"
                onClick={() => setCancelTarget(null)}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="tournament-toast">
          <i className="material-icons">check_circle</i>
          {successText}
        </div>
      )}

    </div>
  )
}

export default Tournaments
