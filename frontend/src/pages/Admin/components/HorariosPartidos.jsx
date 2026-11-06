import { useState, useEffect, useCallback } from 'react'
import {
  getCuadroTorneoApi,
  getCanchasApi,
  setHorarioPartidoApi,
  reprogramarHorariosApi,
  getErrorMessage
} from '../../../services/api'
import { toDateKey, textoHorario, formatHour } from '../../../utils/helpers'
import { ErrorBanner, Loading, EmptyState } from './AdminUI'

const nombresPareja = (c) => (c?.nombres?.length ? c.nombres.join(' / ') : c?.equipo ? `Pareja #${c.equipo}` : 'Por definir')

// Fila editable: fecha, hora y cancha de un partido
function FilaHorario({ partido, canchas, torneo, onGuardado }) {
  const inicial = {
    fecha: toDateKey(partido.horario?.fecha) || '',
    hora_inicio: partido.horario?.hora_inicio || '',
    cancha_id: partido.horario?.cancha?._id || ''
  }
  const [valores, setValores] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const cambiado = JSON.stringify(valores) !== JSON.stringify(inicial)

  const set = (campo) => (e) => setValores(v => ({ ...v, [campo]: e.target.value }))

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const res = await setHorarioPartidoApi(torneo._id, partido._id, {
        fecha: valores.fecha || null,
        hora_inicio: valores.fecha ? valores.hora_inicio || null : null,
        cancha_id: valores.fecha ? valores.cancha_id || null : null
      })
      onGuardado(res.data.cuadro)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo guardar el horario'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <tr>
      <td>
        <strong>{nombresPareja(partido.equipo_a)}</strong>
        <div className="adm-muted">vs {nombresPareja(partido.equipo_b)}</div>
        {error && <div className="tor-horario-error">{error}</div>}
      </td>
      <td className="adm-muted tor-horario-actual">{textoHorario(partido.horario)}</td>
      <td>
        <div className="tor-horario-campos">
          <input
            type="date"
            aria-label="Fecha"
            min={toDateKey(torneo.fecha_inicio)}
            max={toDateKey(torneo.fecha_fin)}
            value={valores.fecha}
            onChange={set('fecha')}
          />
          <input type="time" aria-label="Hora" step="900" value={valores.hora_inicio} onChange={set('hora_inicio')} />
          <select className="browser-default" aria-label="Cancha" value={valores.cancha_id} onChange={set('cancha_id')}>
            <option value="">Sin cancha</option>
            {canchas.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
          </select>
          <button
            type="button"
            className="adm-btn adm-btn--small"
            disabled={!cambiado || guardando || (valores.fecha && !valores.hora_inicio)}
            onClick={guardar}
          >
            {guardando ? '...' : 'Guardar'}
          </button>
        </div>
      </td>
    </tr>
  )
}

// Pestaña "Horarios" del detalle de un torneo: el admin ve y ajusta cuándo y
// dónde se juega cada partido, o recalcula todo con la franja y canchas del torneo
function HorariosPartidos({ torneo }) {
  const [cuadro, setCuadro] = useState(null)
  const [canchas, setCanchas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [recalculando, setRecalculando] = useState(false)
  const [version, setVersion] = useState(0) // reinicia las filas tras recalcular

  const cargar = useCallback(async (isCancelled = () => false) => {
    try {
      const [resCuadro, resCanchas] = await Promise.all([getCuadroTorneoApi(torneo._id), getCanchasApi(true)])
      if (!isCancelled()) {
        setCuadro(resCuadro.data)
        setCanchas(resCanchas.data)
        setError('')
      }
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudieron cargar los horarios'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [torneo._id])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    cargar(() => cancelled)
    return () => { cancelled = true }
  }, [cargar])

  const recalcular = async () => {
    setRecalculando(true)
    setError('')
    try {
      const res = await reprogramarHorariosApi(torneo._id)
      setCuadro(res.data.cuadro)
      setVersion(v => v + 1)
      setConfirmar(false)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron recalcular los horarios'))
    } finally {
      setRecalculando(false)
    }
  }

  if (loading) return <Loading text="Cargando horarios..." />
  if (!cuadro?.publicado) {
    return <EmptyState icon="schedule" text="Los horarios se programan al cerrar las inscripciones, junto con el cuadro." />
  }

  // Los partidos contra BYE no se juegan
  const rondas = cuadro.rondas.map(r => ({
    ...r,
    partidos: r.partidos.filter(p => !p.equipo_a?.bye && !p.equipo_b?.bye)
  }))

  return (
    <div className="tor-horarios">
      <ErrorBanner message={error} />
      <div className="tor-horarios-head">
        <p className="adm-muted">
          Franja del torneo: {formatHour(torneo.hora_inicio || '08:00')} – {formatHour(torneo.hora_fin || '20:00')} · partidos de {torneo.duracion_partido_min || 90} min.
          Los jugadores ven estos horarios en el cuadro y en "Mis partidos".
        </p>
        {confirmar ? (
          <div className="tor-acciones">
            <span className="adm-muted">Se reemplazan los horarios ajustados a mano.</span>
            <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setConfirmar(false)} disabled={recalculando}>Volver</button>
            <button type="button" className="adm-btn adm-btn--small tor-btn-teal" onClick={recalcular} disabled={recalculando}>
              {recalculando ? 'Recalculando...' : 'Sí, recalcular'}
            </button>
          </div>
        ) : (
          <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => setConfirmar(true)}>
            <i className="material-icons">auto_fix_high</i> Recalcular horarios
          </button>
        )}
      </div>

      {rondas.map(r => r.partidos.length > 0 && (
        <div className="tor-horarios-ronda" key={r.ronda}>
          <h6>{r.nombre}</h6>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Partido</th>
                  <th>Horario actual</th>
                  <th>Cambiar</th>
                </tr>
              </thead>
              <tbody>
                {r.partidos.map(p => (
                  <FilaHorario
                    key={`${p._id}-${version}-${p.horario?.fecha ?? ''}-${p.horario?.hora_inicio ?? ''}-${p.horario?.cancha?._id ?? ''}`}
                    partido={p}
                    canchas={canchas}
                    torneo={torneo}
                    onGuardado={setCuadro}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export default HorariosPartidos
