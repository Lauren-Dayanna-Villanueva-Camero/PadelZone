import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCanchas } from '../../hooks/useCanchas'
import { getCourtImage, getCourtTypeIcon, getCourtDescription, formatPrice } from '../../utils/helpers'
import './Courts.css'

const CARD_GAP = 32

// Tarjetas visibles según el ancho de pantalla
const visibleFor = (width) => (width < 640 ? 1 : width < 1024 ? 2 : 3)

// Adapta una cancha del backend al formato de las tarjetas
const toCard = (cancha) => ({
  id: cancha._id,
  img: getCourtImage(cancha),
  name: cancha.nombre,
  price: `${formatPrice(cancha.precio_por_hora)}/hora`,
  desc: getCourtDescription(cancha),
  type: cancha.tipo,
  typeIcon: getCourtTypeIcon(cancha),
  features: cancha.caracteristicas || []
})

function Courts() {
  const viewportRef = useRef(null)
  const [visible, setVisible] = useState(() => visibleFor(window.innerWidth))
  const visibleRef = useRef(visible)
  const [current, setCurrent] = useState(visible)
  const [animated, setAnimated] = useState(true)
  const [cardWidth, setCardWidth] = useState(300)
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [selectedCourt, setSelectedCourt] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { canchas, loading, error } = useCanchas()
  const courts = canchas.map(toCard)
  // Con pocas canchas no hay carrusel infinito: se muestran fijas y sin flechas
  const looping = courts.length > visible
  const cloned = looping
    ? [...courts.slice(-visible), ...courts, ...courts.slice(0, visible)]
    : courts

  // Calcular ancho al montar y al redimensionar
  // (el viewport solo existe cuando ya cargaron las canchas)
  useEffect(() => {
    const calcWidth = () => {
      const v = visibleFor(window.innerWidth)
      if (v !== visibleRef.current) {
        // Cambian los clones del carrusel infinito: se vuelve a la primera cancha
        visibleRef.current = v
        setVisible(v)
        setAnimated(false)
        setCurrent(v)
      }
      if (viewportRef.current) {
        const total = viewportRef.current.offsetWidth
        setCardWidth((total - CARD_GAP * (v - 1)) / v)
      }
    }
    calcWidth()
    window.addEventListener('resize', calcWidth)
    return () => window.removeEventListener('resize', calcWidth)
  }, [loading])

  // Restaurar animación tras salto
  useEffect(() => {
    if (!animated) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimated(true))
      )
    }
  }, [animated])

  const offset = looping ? -(current * (cardWidth + CARD_GAP)) : 0

  const move = useCallback((direction) => {
    setAnimated(true)
    setCurrent(prev => prev + direction)
  }, [])

  const handleTransitionEnd = useCallback(() => {
    if (current >= courts.length + visible) {
      setAnimated(false)
      setCurrent(visible)
    }
    if (current < visible) {
      setAnimated(false)
      setCurrent(courts.length + visible - 1)
    }
  }, [current, courts.length, visible])

  const realIndex = (current - visible + courts.length) % courts.length

  const openModal = (court) => {
    setSelectedCourt(court)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setTimeout(() => setSelectedCourt(null), 300)
  }

  const handleReserve = (courtId) => {
    closeModal()
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/reservar', search: `?court=${courtId}` } } })
    } else {
      navigate(`/reservar?court=${courtId}`)
    }
  }

  return (
    <section className="courts-section">
      <div className="container">
        <div className="courts-header">
          <h2>Nuestras Canchas</h2>
          <p>Descubre nuestras instalaciones de primera categoría, diseñadas para ofrecerte la mejor experiencia de juego</p>
        </div>
      </div>

      {loading ? (
        <div className="courts-status">
          <i className="material-icons spinning">refresh</i>
          <p>Cargando canchas...</p>
        </div>
      ) : error ? (
        <div className="courts-status" role="alert">
          <i className="material-icons">error_outline</i>
          <p>{error}</p>
        </div>
      ) : courts.length === 0 ? (
        <div className="courts-status">
          <i className="material-icons">sports_tennis</i>
          <p>No hay canchas disponibles por ahora.</p>
        </div>
      ) : (
        <>
          <div className="courts-carousel-wrapper">

            {looping && (
              <button className="courts-arrow left" onClick={() => move(-1)}>
                <i className="material-icons">chevron_left</i>
              </button>
            )}

            <div className="courts-carousel-viewport" ref={viewportRef}>
              <div
                className="courts-track"
                style={{
                  transform: `translateX(${offset}px)`,
                  transition: animated ? 'transform 0.5s ease' : 'none'
                }}
                onTransitionEnd={handleTransitionEnd}
              >
                {cloned.map((court, i) => (
                  <div
                    className="court-card"
                    key={`${court.id}-${i}`}
                    style={{ width: `${cardWidth}px`, minWidth: `${cardWidth}px` }}
                    onClick={() => openModal(court)}
                  >
                    <div className="court-img-wrapper">
                      <img src={court.img} alt={court.name} />
                      <span className="court-badge">
                        <i className="material-icons">{court.typeIcon}</i>
                        {court.type}
                      </span>
                    </div>

                    <div className="court-info">
                      <div className="court-title-row">
                        <h5>{court.name}</h5>
                        <span className="court-price">{court.price}</span>
                      </div>
                      <p className="court-desc">{court.desc}</p>
                      <p className="court-capacity">
                        <i className="material-icons">group</i>
                        Capacidad: 4 jugadores
                      </p>
                      {court.features.length > 0 && (
                        <>
                          <p className="court-features-title">Características:</p>
                          <ul className="court-features">
                            {court.features.map((f, j) => (
                              <li key={j}>
                                <i className="material-icons">check</i>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <button
                        className="btn court-btn waves-effect waves-light"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReserve(court.id)
                        }}
                      >
                        Reservar Ahora
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {looping && (
              <button className="courts-arrow right" onClick={() => move(1)}>
                <i className="material-icons">chevron_right</i>
              </button>
            )}

          </div>

          {looping && (
            <div className="courts-dots">
              {courts.map((_, i) => (
                <span
                  key={i}
                  className={`courts-dot ${i === realIndex ? 'active' : ''}`}
                  onClick={() => { setAnimated(true); setCurrent(i + visible) }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="button-container">
        <button className="btn-outline-courts" onClick={() => window.location.href = '/canchas'}>
          Ver Todas las Canchas <i className="material-icons right">arrow_forward</i>
        </button>
      </div>

      {/* Modal de detalles de cancha */}
      {modalOpen && selectedCourt && (
        <div className="court-modal-overlay" onClick={closeModal}>
          <div className="court-modal" onClick={e => e.stopPropagation()}>
            <button className="court-modal-close" onClick={closeModal}>
              <i className="material-icons">close</i>
            </button>

            <div className="court-modal-content">
              <div className="court-modal-img-wrapper">
                <img src={selectedCourt.img} alt={selectedCourt.name} />
                <span className="court-modal-badge">
                  <i className="material-icons">{selectedCourt.typeIcon}</i>
                  {selectedCourt.type}
                </span>
              </div>

              <div className="court-modal-info">
                <div className="court-modal-title-row">
                  <h3>{selectedCourt.name}</h3>
                  <span className="court-modal-price">{selectedCourt.price}</span>
                </div>

                <p className="court-modal-desc">{selectedCourt.desc}</p>

                <div className="court-modal-capacity">
                  <i className="material-icons">group</i>
                  Capacidad: 4 jugadores
                </div>

                {selectedCourt.features.length > 0 && (
                  <div className="court-modal-features">
                    <h6>Características:</h6>
                    <ul>
                      {selectedCourt.features.map((f, j) => (
                        <li key={j}>
                          <i className="material-icons">check_circle</i>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  className="court-modal-btn waves-effect waves-light"
                  onClick={() => handleReserve(selectedCourt.id)}
                >
                  <i className="material-icons">event</i>
                  Reservar Esta Cancha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}

export default Courts
