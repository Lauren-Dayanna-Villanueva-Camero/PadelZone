import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getMisClasesApi, inscribirClaseApi, cancelarClaseApi, getErrorMessage } from '../../services/api'
import './clases.css'

import imgRegular from '../../img/regular.png'
import imgIntensiva from '../../img/intensivas.jpg'
import imgVerano from '../../img/niños.jpg'
import imgFinde from '../../img/Torneo1.png'
import imgProfeValentina from '../../img/profesora.jpg'
import imgprhombre from '../../img/hombre.png'
import imgprmujer from '../../img/profesora1.jpg'

const profesores = {
  carlos: {
    nombre: 'Carlos Mendoza',
    cargo: 'Director Técnico WPT',
    foto: 'https://randomuser.me/api/portraits/men/32.jpg'
  },
  sofia: {
    nombre: 'Sofía Restrepo',
    cargo: 'Entrenadora Certificada FEP',
    foto: imgprmujer
  },
  andres: {
    nombre: 'Andrés Quiroga',
    cargo: 'Coach de Alto Rendimiento',
    foto: imgprhombre
  },
  valentina: {
    nombre: 'Valentina Salazar',
    cargo: 'Especialista en Formación Junior',
    foto: imgProfeValentina
  }
}

const clases = [
  {
    id: 1,
    tipo: 'Regular',
    nombre: 'Clases Regulares',
    descripcion: 'Aprende las bases del pádel con ritmo constante. Ideal para quienes quieren progresar sin sacrificar su rutina.',
    imagen: imgRegular,
    horasSemana: 8,
    duracionClase: 2,
    diasSemana: 'Lunes, Miércoles y Viernes',
    color: '#1a73e8',
    horarios: ['8:00 AM', '10:00 AM', '4:00 PM', '6:00 PM'],
    grupos: [
      { edad: '10 - 14 años', profesor: profesores.valentina, precio: '$180.000 / mes', cupos: '8/12' },
      { edad: '15 - 21 años', profesor: profesores.sofia, precio: '$200.000 / mes', cupos: '6/10' },
      { edad: '22 años en adelante', profesor: profesores.carlos, precio: '$220.000 / mes', cupos: '9/12' }
    ]
  },
  {
    id: 2,
    tipo: 'Intensiva',
    nombre: 'Clases Intensivas',
    descripcion: 'Programa de alto rendimiento para jugadores que quieren subir de nivel rápidamente con entrenamiento diario.',
    imagen: imgIntensiva,
    horasSemana: 12,
    duracionClase: 2,
    diasSemana: 'Lunes a Sábado',
    color: '#e53935',
    horarios: ['7:00 AM', '9:00 AM', '3:00 PM', '5:00 PM'],
    grupos: [
      { edad: '10 - 14 años', profesor: profesores.valentina, precio: '$280.000 / mes', cupos: '5/8' },
      { edad: '15 - 21 años', profesor: profesores.andres, precio: '$320.000 / mes', cupos: '4/8' },
      { edad: '22 años en adelante', profesor: profesores.andres, precio: '$350.000 / mes', cupos: '7/10' }
    ]
  },
  {
    id: 3,
    tipo: 'Verano',
    nombre: 'Clases de Verano',
    descripcion: 'Aprovecha la temporada para iniciarte o perfeccionar tu juego. Ambiente dinámico y grupos reducidos.',
    imagen: imgVerano,
    horasSemana: 10,
    duracionClase: 2,
    diasSemana: 'Martes, Jueves y Sábado',
    color: '#f9a825',
    horarios: ['8:00 AM', '10:00 AM', '2:00 PM', '4:00 PM'],
    grupos: [
      { edad: '10 - 14 años', profesor: profesores.valentina, precio: '$150.000 / mes', cupos: '10/14' },
      { edad: '15 - 21 años', profesor: profesores.sofia, precio: '$170.000 / mes', cupos: '8/12' },
      { edad: '22 años en adelante', profesor: profesores.carlos, precio: '$190.000 / mes', cupos: '11/14' }
    ]
  },
  {
    id: 4,
    tipo: 'Fin de Semana',
    nombre: 'Clases Fin de Semana',
    descripcion: 'Para quienes trabajan entre semana. Clases concentradas el sábado y domingo para no perder el ritmo.',
    imagen: imgFinde,
    horasSemana: 8,
    duracionClase: 4,
    diasSemana: 'Sábado y Domingo',
    color: '#43a047',
    horarios: ['9:00 AM', '11:00 AM', '3:00 PM', '5:00 PM'],
    grupos: [
      { edad: '10 - 14 años', profesor: profesores.valentina, precio: '$160.000 / mes', cupos: '6/10' },
      { edad: '15 - 21 años', profesor: profesores.sofia, precio: '$180.000 / mes', cupos: '5/10' },
      { edad: '22 años en adelante', profesor: profesores.carlos, precio: '$200.000 / mes', cupos: '8/12' }
    ]
  }
]

const formatCard = (val) =>
  val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()

const formatExpiry = (val) =>
  val.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')

// Los datos de la tarjeta nunca se envían ni se guardan: el pago es simulado
const buildInscripcion = (clase, grupo, form) => ({
  clase_id: clase.id,
  clase_nombre: clase.nombre,
  tipo_clase: clase.tipo,
  color: clase.color,
  grupo: grupo.edad,
  profesor: grupo.profesor.nombre,
  dias: clase.diasSemana,
  horario: form.horario,
  precio: grupo.precio,
  nivel: form.nivel,
  nombre_alumno: form.nombre.trim(),
  telefono: form.telefono.trim(),
  fecha_nacimiento: form.fechaNacimiento
})

const emptyForm = (user) => ({
  nombre: [user?.nombre, user?.apellido].filter(Boolean).join(' '),
  telefono: user?.telefono || '',
  fechaNacimiento: '',
  nivel: 'principiante',
  horario: ''
})

function Clases() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState('active')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [misClases, setMisClases] = useState([])
  const [cancelError, setCancelError] = useState('')

  // Si el usuario llega desde el login para inscribirse, el modal se abre directamente
  const [pending] = useState(() => {
    const s = location.state
    return isAuthenticated && s?.clase && s?.grupo ? s : null
  })

  const [selectedClase, setSelectedClase] = useState(pending?.clase ?? null)
  const [selectedGrupo, setSelectedGrupo] = useState(pending?.grupo ?? null)
  const [showModal, setShowModal] = useState(!!pending)
  const [step, setStep] = useState('form')
  const [showSuccess, setShowSuccess] = useState(false)

  const [form, setForm] = useState(() => pending
    ? { ...emptyForm(user), horario: pending.clase.horarios[0] }
    : { nombre: '', telefono: '', fechaNacimiento: '', nivel: '', horario: '' })
  const [formError, setFormError] = useState('')

  const [payment, setPayment] = useState({ card: '', holder: '', expiry: '', cvv: '' })
  const [paymentError, setPaymentError] = useState('')
  const [paying, setPaying] = useState(false)

  const loadMisClases = () => {
    getMisClasesApi()
      .then(res => setMisClases(res.data))
      .catch(() => setMisClases([]))
  }

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    getMisClasesApi()
      .then(res => { if (!cancelled) setMisClases(res.data) })
      .catch(() => { if (!cancelled) setMisClases([]) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  // Limpia el estado de navegación para que el modal no se reabra al recargar
  useEffect(() => {
    if (pending) navigate(location.pathname, { replace: true, state: null })
  }, [pending, navigate, location.pathname])

  const handleCancelarClase = async (id) => {
    setCancelError('')
    try {
      await cancelarClaseApi(id)
      setMisClases(prev => prev.filter(c => c._id !== id))
      setCancelTarget(null)
    } catch (err) {
      setCancelError(getErrorMessage(err, 'No se pudo cancelar la inscripción.'))
    }
  }

  const handleOpenModal = (clase, grupo) => {
    setSelectedClase(clase)
    setSelectedGrupo(grupo)
    setForm({ ...emptyForm(user), horario: clase.horarios[0] })
    setPayment({ card: '', holder: '', expiry: '', cvv: '' })
    setFormError('')
    setPaymentError('')
    setStep('form')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedClase(null)
    setSelectedGrupo(null)
    setStep('form')
  }

  const handleInscribirse = (clase, grupo) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/clases', clase, grupo } })
      return
    }
    handleOpenModal(clase, grupo)
  }

  const handleNextStep = () => {
    if (!form.nombre || !form.telefono || !form.fechaNacimiento || !form.nivel || !form.horario) {
      setFormError('Por favor completa todos los campos.')
      return
    }
    setFormError('')
    setStep('payment')
  }

  const handlePayment = async () => {
    const rawCard = payment.card.replace(/\s/g, '')
    if (rawCard.length < 16 || !payment.holder || !payment.expiry || payment.cvv.length < 3) {
      setPaymentError('Por favor completa todos los datos de pago.')
      return
    }
    setPaymentError('')
    setPaying(true)

    try {
      await inscribirClaseApi(buildInscripcion(selectedClase, selectedGrupo, form))
      setShowModal(false)
      setPayment({ card: '', holder: '', expiry: '', cvv: '' })
      setShowSuccess(true)
      loadMisClases()
      setTimeout(() => setShowSuccess(false), 3500)
    } catch (err) {
      setPaymentError(getErrorMessage(err, 'No se pudo completar la inscripción.'))
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="clases-page">
      <div className="clases-hero">
        <h1>Clases de Padel</h1>
        <p>Encuentra el programa perfecto para tu edad y nivel. Aprende con los mejores entrenadores.</p>
      </div>

      <div className="clases-container container">

        {isAuthenticated && (
          <div className="tournaments-tabs">
            <button
              className={`tournaments-tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              <i className="material-icons">school</i>
              Clases Disponibles
            </button>
            <button
              className={`tournaments-tab ${activeTab === 'mine' ? 'active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              <i className="material-icons">how_to_reg</i>
              Mis Clases
              {misClases.length > 0 && (
                <span className="tab-count">{misClases.length}</span>
              )}
            </button>
          </div>
        )}

        {activeTab === 'active' && clases.map(clase => (
          <div className="clase-card" key={clase.id}>
            <div className="clase-card-imagen">
              <img src={clase.imagen} alt={clase.nombre} />
              <span className="clase-badge" style={{ backgroundColor: clase.color }}>
                {clase.tipo}
              </span>
            </div>

            <div className="clase-card-body">
              <h2 className="clase-titulo">{clase.nombre}</h2>
              <p className="clase-descripcion">{clase.descripcion}</p>

              <div className="clase-info-row">
                <span><i className="material-icons">schedule</i> {clase.duracionClase}h por clase</span>
                <span><i className="material-icons">fitness_center</i> {clase.horasSemana}h / semana</span>
                <span><i className="material-icons">calendar_today</i> {clase.diasSemana}</span>
              </div>

              <div className="clase-grupos">
                {clase.grupos.map((grupo, i) => (
                  <div className="clase-grupo" key={i}>
                    <div className="grupo-header">
                      <span className="grupo-edad">
                        <i className="material-icons">group</i>
                        {grupo.edad}
                      </span>
                      <span className="grupo-precio">{grupo.precio}</span>
                    </div>

                    <div className="grupo-profesor">
                      <img src={grupo.profesor.foto} alt={grupo.profesor.nombre} className="profesor-foto" />
                      <div>
                        <p className="profesor-nombre">{grupo.profesor.nombre}</p>
                        <p className="profesor-cargo">{grupo.profesor.cargo}</p>
                      </div>
                    </div>

                    <div className="grupo-cupos">
                      <span>Cupos: {grupo.cupos}</span>
                      <div className="cupos-barra">
                        <div
                          className="cupos-fill"
                          style={{
                            width: `${(parseInt(grupo.cupos) / parseInt(grupo.cupos.split('/')[1])) * 100}%`,
                            backgroundColor: clase.color
                          }}
                        />
                      </div>
                    </div>

                    <button
                      className="btn-inscribir"
                      style={{ backgroundColor: clase.color }}
                      onClick={() => handleInscribirse(clase, grupo)}
                    >
                      <i className="material-icons">how_to_reg</i>
                      Inscribirme en este grupo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'mine' && (
          <div className="my-registrations">
            {misClases.length === 0 ? (
              <div className="tournaments-empty">
                <i className="material-icons">school</i>
                <h5>No tienes clases inscritas aun</h5>
                <p>Explora las clases disponibles y encuentra la ideal para ti</p>
                <button className="tournament-btn" onClick={() => setActiveTab('active')}>
                  Ver Clases
                </button>
              </div>
            ) : (
              <div className="my-registrations-grid">
                {misClases.map(ins => (
                  <div className="my-reg-card" key={ins._id}>
                    <div className="my-reg-header" style={{ backgroundColor: ins.color || '#010231' }}>
                      <i className="material-icons">school</i>
                      <span>{ins.tipo_clase}</span>
                    </div>
                    <div className="my-reg-body">
                      <h6>{ins.clase_nombre}</h6>
                      <div className="my-reg-detail">
                        <i className="material-icons">calendar_today</i>
                        <span>{ins.dias}</span>
                      </div>
                      <div className="my-reg-detail">
                        <i className="material-icons">schedule</i>
                        <span>Horario: {ins.horario}</span>
                      </div>
                      <div className="my-reg-detail">
                        <i className="material-icons">group</i>
                        <span>Grupo: {ins.grupo}</span>
                      </div>
                      <div className="my-reg-detail">
                        <i className="material-icons">person</i>
                        <span>Profesor: {ins.profesor}</span>
                      </div>
                      <div className="my-reg-detail">
                        <i className="material-icons">fitness_center</i>
                        <span>Nivel: {ins.nivel}</span>
                      </div>
                      <div className="my-reg-detail">
                        <i className="material-icons">payments</i>
                        <span>Inscripcion: {ins.precio}</span>
                      </div>

                      <div className="my-reg-footer">
                        <span className="my-reg-status">
                          <i className="material-icons">check_circle</i>
                          Confirmada
                        </span>
                        <button
                          className="my-reg-cancel-btn"
                          onClick={() => { setCancelError(''); setCancelTarget(ins._id) }}
                        >
                          <i className="material-icons">cancel</i>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {showModal && selectedClase && selectedGrupo && (
        <div className="tournament-modal-overlay" onClick={handleCloseModal}>
          <div className="tournament-modal" onClick={e => e.stopPropagation()}>

            <div className="tournament-modal-header">
              <div className="tournament-modal-steps">
                <span className={`modal-step ${step === 'form' ? 'active' : 'done'}`}>
                  <i className="material-icons">{step === 'form' ? 'person' : 'check'}</i>
                  Datos
                </span>
                <div className="modal-step-divider" />
                <span className={`modal-step ${step === 'payment' ? 'active' : ''}`}>
                  <i className="material-icons">credit_card</i>
                  Pago
                </span>
              </div>
              <button className="tournament-modal-close" onClick={handleCloseModal}>
                <i className="material-icons">close</i>
              </button>
            </div>

            {step === 'form' && (
              <div className="tournament-modal-body">
                <h6 className="modal-section-title">
                  Inscripcion - {selectedClase.nombre} ({selectedGrupo.edad})
                </h6>

                {formError && (
                  <div className="tournament-form-error">
                    <i className="material-icons">error_outline</i>
                    {formError}
                  </div>
                )}

                <div className="tournament-form-field">
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={form.nombre}
                    onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  />
                </div>

                <div className="tournament-form-field">
                  <label>Telefono</label>
                  <input
                    type="tel"
                    placeholder="+57 300 000 0000"
                    value={form.telefono}
                    onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                  />
                </div>

                <div className="tournament-form-field">
                  <label>Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={form.fechaNacimiento}
                    onChange={e => setForm(p => ({ ...p, fechaNacimiento: e.target.value }))}
                  />
                </div>

                <div className="tournament-form-field">
                  <label>Nivel de juego</label>
                  <div className="tournament-select-wrapper">
                    <select
                      value={form.nivel}
                      onChange={e => setForm(p => ({ ...p, nivel: e.target.value }))}
                    >
                      <option value="">Selecciona tu nivel</option>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                    <i className="material-icons">expand_more</i>
                  </div>
                </div>

                <div className="tournament-form-field">
                  <label>Horario preferido</label>
                  <div className="tournament-select-wrapper">
                    <select
                      value={form.horario}
                      onChange={e => setForm(p => ({ ...p, horario: e.target.value }))}
                    >
                      {selectedClase.horarios.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <i className="material-icons">expand_more</i>
                  </div>
                </div>

                <div className="tournament-modal-info">
                  <p><i className="material-icons">group</i> Grupo: {selectedGrupo.edad}</p>
                  <p><i className="material-icons">calendar_today</i> {selectedClase.diasSemana}</p>
                  <p><i className="material-icons">emoji_events</i> Profesor: {selectedGrupo.profesor.nombre}</p>
                </div>

                <button className="tournament-modal-btn" style={{ backgroundColor: selectedClase.color }} onClick={handleNextStep}>
                  <i className="material-icons">arrow_forward</i>
                  Continuar al Pago - {selectedGrupo.precio}
                </button>
              </div>
            )}

            {step === 'payment' && (
              <div className="tournament-modal-body">
                <h6 className="modal-section-title">Pago de Inscripcion</h6>

                <div className="payment-summary">
                  <div className="payment-summary-row">
                    <span>Clase</span>
                    <span>{selectedClase.nombre}</span>
                  </div>
                  <div className="payment-summary-row">
                    <span>Grupo</span>
                    <span>{selectedGrupo.edad}</span>
                  </div>
                  <div className="payment-summary-row total">
                    <span>Total mensual</span>
                    <span style={{ color: selectedClase.color }}>{selectedGrupo.precio}</span>
                  </div>
                </div>

                {paymentError && (
                  <div className="tournament-form-error">
                    <i className="material-icons">error_outline</i>
                    {paymentError}
                  </div>
                )}

                <div className="credit-card-preview" style={{ background: selectedClase.color }}>
                  <div className="credit-card-chip">
                    <i className="material-icons">contactless</i>
                  </div>
                  <div className="credit-card-number">
                    {payment.card || 'xxxx xxxx xxxx xxxx'}
                  </div>
                  <div className="credit-card-bottom">
                    <div>
                      <p className="credit-card-label">Titular</p>
                      <p className="credit-card-value">{payment.holder || 'NOMBRE APELLIDO'}</p>
                    </div>
                    <div>
                      <p className="credit-card-label">Vence</p>
                      <p className="credit-card-value">{payment.expiry || 'MM/AA'}</p>
                    </div>
                  </div>
                </div>

                <div className="tournament-form-field">
                  <label>Numero de tarjeta</label>
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
                      placeholder="xxx"
                      value={payment.cvv}
                      maxLength={4}
                      onChange={e => setPayment(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '') }))}
                    />
                  </div>
                </div>

                <p className="payment-disclaimer">
                  <i className="material-icons">lock</i>
                  Pago simulado - ningun dato real es procesado
                </p>

                <div className="payment-actions">
                  <button className="payment-back-btn" onClick={() => setStep('form')} disabled={paying}>
                    <i className="material-icons">arrow_back</i>
                    Volver
                  </button>
                  <button
                    className="tournament-modal-btn"
                    style={{ backgroundColor: selectedClase.color }}
                    onClick={handlePayment}
                    disabled={paying}
                  >
                    {paying ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="material-icons spinning">refresh</i>
                        Procesando...
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="material-icons">payment</i>
                        Pagar e Inscribir
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="tournament-modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="cancel-modal-icon">
              <i className="material-icons">warning</i>
            </div>
            <h5>Cancelar inscripcion?</h5>
            <p>Esta accion no se puede deshacer y perderas tu cupo en la clase.</p>
            {cancelError && (
              <div className="tournament-form-error" role="alert">
                <i className="material-icons">error_outline</i>
                {cancelError}
              </div>
            )}
            <div className="cancel-modal-actions">
              <button
                className="cancel-modal-confirm"
                onClick={() => handleCancelarClase(cancelTarget)}
              >
                Si, cancelar
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
          Inscripcion confirmada exitosamente!
        </div>
      )}
    </div>
  )
}

export default Clases