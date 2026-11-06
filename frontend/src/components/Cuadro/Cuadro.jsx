import { useState, useEffect, useCallback } from 'react'
import { getCuadroTorneoApi, setGanadorPartidoApi, getErrorMessage } from '../../services/api'
import { textoHorario, formatDateShort, formatHour } from '../../utils/helpers'
import './Cuadro.css'

// Casilla de un partido: pareja, BYE (solo primera ronda) o por definir (null)
function Casilla({ casilla, partido, miEquipo, puedeElegir, onElegir, guardando }) {
  if (!casilla) {
    return <div className="cuadro-casilla vacia">Por definir</div>
  }
  if (casilla.bye) {
    return <div className="cuadro-casilla bye">BYE</div>
  }

  const gano = partido.ganador === casilla.equipo
  const perdio = partido.ganador != null && !gano
  const clases = ['cuadro-casilla', gano && 'ganador', perdio && 'perdedor', casilla.equipo === miEquipo && 'mio']
    .filter(Boolean).join(' ')
  const nombres = casilla.nombres.join(' / ') || `Pareja #${casilla.equipo}`

  return (
    <div className={clases}>
      <span className="cuadro-nombres" title={nombres}>{nombres}</span>
      {gano && !puedeElegir && <i className="material-icons cuadro-check">check_circle</i>}
      {puedeElegir && (
        <button
          type="button"
          className={`cuadro-elegir ${gano ? 'activo' : ''}`}
          title={gano ? 'Quitar ganador' : 'Marcar como ganador'}
          disabled={guardando}
          onClick={() => onElegir(partido, gano ? null : casilla.equipo)}
        >
          <i className="material-icons">{gano ? 'emoji_events' : 'military_tech'}</i>
        </button>
      )}
    </div>
  )
}

// Día, hora y cancha del partido. Un partido contra BYE no se juega.
// Dos líneas fijas (día y hora / cancha) para que todas las casillas midan lo mismo
// y las líneas del cuadro queden alineadas
function Horario({ partido }) {
  const bye = partido.equipo_a?.bye || partido.equipo_b?.bye
  const h = partido.horario
  const linea1 = bye ? 'Pasa directo' : h ? `${formatDateShort(h.fecha)} · ${formatHour(h.hora_inicio)}` : 'Horario por definir'
  const linea2 = bye ? 'Sin partido (BYE)' : h ? h.cancha?.nombre ?? 'Cancha por definir' : 'Se publicará pronto'
  return (
    <div className={`cuadro-horario ${!bye && h ? '' : 'pendiente'}`} title={bye ? linea1 : textoHorario(h)}>
      <i className="material-icons">{bye ? 'fast_forward' : 'schedule'}</i>
      <span className="cuadro-horario-texto">
        <span>{linea1}</span>
        <small>{linea2}</small>
      </span>
    </div>
  )
}

function Partido({ partido, ...props }) {
  return (
    <div className="cuadro-partido">
      <Horario partido={partido} />
      <Casilla casilla={partido.equipo_a} partido={partido} {...props} />
      <Casilla casilla={partido.equipo_b} partido={partido} {...props} />
    </div>
  )
}

// Una ronda de un lado del cuadro. Los partidos van de a dos (las dos llaves
// que alimentan el mismo partido de la ronda siguiente) para dibujar la unión.
function Columna({ ronda, partidos, lado, recibe, renderPartido }) {
  const pares = []
  for (let i = 0; i < partidos.length; i += 2) pares.push(partidos.slice(i, i + 2))

  return (
    <div className={`cuadro-col ${lado} ${recibe ? 'recibe' : ''}`}>
      <div className="cuadro-col-titulo">{ronda.nombre}</div>
      <div className="cuadro-col-cuerpo">
        {pares.map(par => (
          <div className={`cuadro-par ${par.length === 1 ? 'solo' : ''}`} key={par[0]._id}>
            {par.map(renderPartido)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Cuadro de eliminación en dos lados: la mitad de las llaves a la izquierda,
// la otra mitad a la derecha y la final al centro. Con `admin` permite marcar ganadores.
function Cuadro({ torneoId, admin = false }) {
  const [cuadro, setCuadro] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async (isCancelled = () => false) => {
    try {
      const res = await getCuadroTorneoApi(torneoId)
      if (!isCancelled()) { setCuadro(res.data); setError('') }
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudo cargar el cuadro'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [torneoId])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    cargar(() => cancelled)
    return () => { cancelled = true }
  }, [cargar])

  const elegirGanador = async (partido, ganador) => {
    setGuardando(true)
    setError('')
    try {
      const res = await setGanadorPartidoApi(torneoId, partido._id, ganador)
      setCuadro(res.data.cuadro)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo registrar el resultado'))
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="cuadro-mensaje">
        <i className="material-icons cuadro-spin">refresh</i>
        Cargando cuadro...
      </div>
    )
  }

  if (!cuadro) {
    return (
      <div className="cuadro-mensaje error">
        <i className="material-icons">error_outline</i>
        {error}
      </div>
    )
  }

  if (!cuadro.publicado) {
    return (
      <div className="cuadro-mensaje">
        <i className="material-icons">schedule</i>
        {cuadro.message || 'El cuadro se publicará al cerrar las inscripciones'}
      </div>
    )
  }

  const { rondas, campeon, mi_equipo: miEquipo } = cuadro
  if (rondas.length === 0) {
    return (
      <div className="cuadro-mensaje">
        <i className="material-icons">groups</i>
        No hay parejas suficientes para armar el cuadro.
      </div>
    )
  }

  // Solo se puede cambiar un resultado mientras la pareja no haya jugado la ronda siguiente
  const editable = (p) => {
    if (!admin || cuadro.estado === 'cancelado') return false
    if (!p.equipo_a?.equipo || !p.equipo_b?.equipo) return false
    const siguiente = rondas[p.ronda]?.partidos[Math.floor(p.posicion / 2)]
    return !siguiente || siguiente.ganador == null
  }

  const renderPartido = (p) => (
    <Partido
      key={p._id}
      partido={p}
      miEquipo={miEquipo}
      puedeElegir={editable(p)}
      onElegir={elegirGanador}
      guardando={guardando}
    />
  )

  const final = rondas.at(-1)
  const previas = rondas.slice(0, -1)
  const mitad = (r) => r.partidos.length / 2
  const izquierda = previas.map((r, i) => ({ r, partidos: r.partidos.slice(0, mitad(r)), recibe: i > 0 }))
  const derecha = previas.map((r, i) => ({ r, partidos: r.partidos.slice(mitad(r)), recibe: i > 0 })).reverse()

  return (
    <div className="cuadro-wrap">
      {error && (
        <div className="cuadro-error">
          <i className="material-icons">error_outline</i>
          {error}
        </div>
      )}
      {admin && (
        <p className="cuadro-ayuda">
          <i className="material-icons">info</i>
          Toca la medalla de una pareja para marcarla como ganadora; tócala de nuevo para quitar el resultado.
        </p>
      )}

      <p className="cuadro-deslizar">
        <i className="material-icons">swipe</i>
        Desliza hacia los lados para ver todo el cuadro
      </p>

      <div className="cuadro-scroll">
        <div className="cuadro">
          {izquierda.map(({ r, partidos, recibe }) => (
            <Columna key={`izq-${r.ronda}`} ronda={r} partidos={partidos} lado="izq" recibe={recibe} renderPartido={renderPartido} />
          ))}

          <div className={`cuadro-col final ${previas.length ? '' : 'unico'}`}>
            <div className="cuadro-col-titulo">{final.nombre}</div>
            <div className="cuadro-col-cuerpo">
              <div className="cuadro-par solo">
                <div className="cuadro-final-wrap">
                  {renderPartido(final.partidos[0])}
                  <div className={`cuadro-campeon ${campeon?.equipo === miEquipo ? 'mio' : ''}`}>
                    <i className="material-icons">emoji_events</i>
                    <span>{campeon ? campeon.nombres.join(' / ') || `Pareja #${campeon.equipo}` : 'Campeón por definir'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {derecha.map(({ r, partidos, recibe }) => (
            <Columna key={`der-${r.ronda}`} ronda={r} partidos={partidos} lado="der" recibe={recibe} renderPartido={renderPartido} />
          ))}
        </div>
      </div>

      {miEquipo != null && (
        <p className="cuadro-leyenda">
          <span className="cuadro-leyenda-mio" /> Tu pareja
        </p>
      )}
    </div>
  )
}

export default Cuadro
