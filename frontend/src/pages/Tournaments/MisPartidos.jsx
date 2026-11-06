import { useState, useEffect, useCallback } from 'react'
import { getMisPartidosApi, getErrorMessage } from '../../services/api'
import { formatHour, toDateKey, todayKey } from '../../utils/helpers'
import './MisPartidos.css'

const resultados = {
  pendiente: { label: 'Por jugar', icon: 'schedule' },
  ganado: { label: 'Ganado', icon: 'emoji_events' },
  perdido: { label: 'Perdido', icon: 'sentiment_dissatisfied' },
  // Ya pasó el día del partido pero el organizador no ha cargado el ganador
  sin_resultado: { label: 'Resultado pendiente', icon: 'hourglass_empty' }
}

const yaPaso = (p) => p.horario && toDateKey(p.horario.fecha) < todayKey()

// Bloque de calendario: día y mes grandes para ubicar el partido de un vistazo
function Dia({ fecha }) {
  if (!fecha) {
    return (
      <div className="mp-dia pendiente">
        <i className="material-icons">event_busy</i>
      </div>
    )
  }
  const d = new Date(toDateKey(fecha) + 'T00:00:00')
  return (
    <div className="mp-dia">
      <span className="mp-dia-semana">{d.toLocaleDateString('es-CO', { weekday: 'short' })}</span>
      <span className="mp-dia-num">{d.getDate()}</span>
      <span className="mp-dia-mes">{d.toLocaleDateString('es-CO', { month: 'short' })}</span>
    </div>
  )
}

function TarjetaPartido({ p }) {
  const estado = p.resultado === 'pendiente' && yaPaso(p) ? 'sin_resultado' : p.resultado
  const r = resultados[estado]
  return (
    <div className={`mp-card ${estado}`}>
      <Dia fecha={p.horario?.fecha} />
      <div className="mp-info">
        <div className="mp-torneo">
          <span>{p.torneo.nombre}</span>
          <span className="mp-ronda">{p.ronda}</span>
        </div>
        <div className="mp-rival">
          vs <strong>{p.rival ? p.rival.nombres.join(' / ') || `Pareja #${p.rival.equipo}` : 'Rival por definir'}</strong>
        </div>
        <div className="mp-detalles">
          {p.horario ? (
            <>
              <span><i className="material-icons">schedule</i>{formatHour(p.horario.hora_inicio)} – {formatHour(p.horario.hora_fin)}</span>
              {p.horario.cancha && <span><i className="material-icons">sports_tennis</i>{p.horario.cancha.nombre}</span>}
            </>
          ) : (
            <span><i className="material-icons">info</i>El organizador aún no asigna el horario</span>
          )}
        </div>
      </div>
      <span className={`mp-resultado ${estado}`}>
        <i className="material-icons">{r.icon}</i>
        {r.label}
      </span>
    </div>
  )
}

// Pestaña "Mis partidos": todos los partidos del usuario con día, hora y cancha
function MisPartidos() {
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async (isCancelled = () => false) => {
    try {
      const res = await getMisPartidosApi()
      if (!isCancelled()) { setPartidos(res.data); setError('') }
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudieron cargar tus partidos'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    cargar(() => cancelled)
    return () => { cancelled = true }
  }, [cargar])

  if (loading) {
    return (
      <div className="tournaments-empty">
        <i className="material-icons spinning">refresh</i>
        <p>Cargando tus partidos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tournaments-empty">
        <i className="material-icons">error_outline</i>
        <h5>{error}</h5>
      </div>
    )
  }

  if (partidos.length === 0) {
    return (
      <div className="tournaments-empty">
        <i className="material-icons">event</i>
        <h5>Aún no tienes partidos programados</h5>
        <p>Cuando cierren las inscripciones de tus torneos se arma el cuadro y aquí verás el día, la hora y la cancha de cada partido.</p>
      </div>
    )
  }

  // Los partidos cuyo día ya pasó van con los jugados aunque falte el resultado
  const porJugar = partidos.filter(p => p.resultado === 'pendiente' && !yaPaso(p))
  const jugados = partidos.filter(p => p.resultado !== 'pendiente' || yaPaso(p))

  return (
    <div className="mis-partidos">
      <div className="mp-seccion">
        <h6><i className="material-icons">update</i> Próximos partidos ({porJugar.length})</h6>
        {porJugar.length === 0
          ? <p className="mp-vacio">No tienes partidos pendientes.</p>
          : porJugar.map(p => <TarjetaPartido key={p.partido_id} p={p} />)}
      </div>
      {jugados.length > 0 && (
        <div className="mp-seccion">
          <h6><i className="material-icons">history</i> Partidos jugados ({jugados.length})</h6>
          {jugados.map(p => <TarjetaPartido key={p.partido_id} p={p} />)}
        </div>
      )}
    </div>
  )
}

export default MisPartidos
