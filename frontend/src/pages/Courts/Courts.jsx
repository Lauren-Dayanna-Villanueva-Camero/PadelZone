import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCanchas } from '../../hooks/useCanchas'
import { getCourtImage, getCourtTypeIcon, getCourtDescription, formatPrice } from '../../utils/helpers'
import './Courts.css'

const filters = ['Todas', 'Interior', 'Exterior']

function CourtsPage() {
  const [activeFilter, setActiveFilter] = useState('Todas')
  const [sortBy, setSortBy] = useState('default')
  const navigate = useNavigate()
  const { canchas, loading, error } = useCanchas()

  // Por defecto se mantiene el orden en que llegan del backend
  const filtered = canchas
    .filter(c => activeFilter === 'Todas' || c.tipo === activeFilter)
    .sort((a, b) => {
      if (sortBy === 'asc')  return a.precio_por_hora - b.precio_por_hora
      if (sortBy === 'desc') return b.precio_por_hora - a.precio_por_hora
      return 0
    })

  return (
    <div className="courts-page">

      {/* Header */}
      <div className="courts-page-header">
        <div className="container">
          <h1>Nuestras Canchas</h1>
          <p>Encuentra la cancha perfecta para tu nivel y estilo de juego</p>
        </div>
      </div>

      <div className="container courts-page-body">

        {/* Barra de filtros */}
        <div className="courts-filter-bar">
          <div className="courts-filter-types">
            {filters.map(f => (
              <button
                key={f}
                className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="courts-sort">
            <label>Ordenar por precio:</label>
            <div className="res-select-wrapper">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="default">Por defecto</option>
                <option value="asc">Menor a mayor</option>
                <option value="desc">Mayor a menor</option>
              </select>
              <i className="material-icons">expand_more</i>
            </div>
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
        ) : (
          <>
            {/* Contador */}
            <p className="courts-count">
              {filtered.length} {filtered.length === 1 ? 'cancha encontrada' : 'canchas encontradas'}
            </p>

            {/* Grid */}
            <div className="courts-page-grid">
              {filtered.map(court => (
                <div className="court-page-card" key={court._id}>

                  <div className="court-img-wrapper">
                    <img src={getCourtImage(court)} alt={court.nombre} />
                    <span className="court-badge">
                      <i className="material-icons">{getCourtTypeIcon(court)}</i>
                      {court.tipo}
                    </span>
                  </div>

                  <div className="court-info">
                    <div className="court-title-row">
                      <h5>{court.nombre}</h5>
                      <span className="court-price">{formatPrice(court.precio_por_hora)}/hora</span>
                    </div>
                    <p className="court-desc">{getCourtDescription(court)}</p>
                    <p className="court-capacity">
                      <i className="material-icons">group</i>
                      Capacidad: 4 jugadores
                    </p>
                    {court.caracteristicas?.length > 0 && (
                      <>
                        <p className="court-features-title">Características:</p>
                        <ul className="court-features">
                          {court.caracteristicas.map((f, i) => (
                            <li key={i}>
                              <i className="material-icons">check</i>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <button
                      className="btn court-btn waves-effect waves-light"
                      onClick={() => navigate(`/reservar?court=${court._id}`)}
                    >
                      Reservar Ahora
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default CourtsPage
