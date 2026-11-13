import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCalendarioApi, getCanchasApi, getErrorMessage } from '../../services/api'
import { addDaysKey, todayKey, formatHour, formatPrice } from '../../utils/helpers'
import './Calendario.css'

// Calendario visual de reservas, partidos de torneo, torneos y clases.
// admin: todo el club con filtro por cancha; usuario: solo lo suyo.

const TIPOS = {
  reserva: { label: 'Reservas', icon: 'event_available' },
  partido: { label: 'Partidos', icon: 'sports_tennis' },
  torneo: { label: 'Torneos', icon: 'emoji_events' },
  clase: { label: 'Clases', icon: 'school' }
}

const VISTAS = [
  { id: 'mes', label: 'Mes', icon: 'calendar_view_month' },
  { id: 'semana', label: 'Semana', icon: 'view_week' },
  { id: 'lista', label: 'Lista', icon: 'view_agenda' }
]

const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const HORA_INICIO = 7
const HORA_FIN = 23
const PX_HORA = 46

const pad = (n) => String(n).padStart(2, '0')
const aFecha = (key) => new Date(`${key}T00:00:00`)
const aKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const lunesDe = (key) => addDaysKey(key, -((aFecha(key).getDay() + 6) % 7))
const primeroDelMes = (key) => `${key.slice(0, 8)}01`
const ultimoDelMes = (key) => {
  const d = aFecha(primeroDelMes(key))
  return aKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
const minutos = (hora) => {
  const [h, m] = (hora || '00:00').split(':').map(Number)
  return h * 60 + m
}

const rangoDe = (vista, ancla) => {
  if (vista === 'semana') {
    const desde = lunesDe(ancla)
    return { desde, hasta: addDaysKey(desde, 6) }
  }
  if (vista === 'lista') return { desde: primeroDelMes(ancla), hasta: ultimoDelMes(ancla) }
  const desde = lunesDe(primeroDelMes(ancla))
  return { desde, hasta: addDaysKey(desde, 41) }
}

const diasEntre = (desde, hasta) => {
  const dias = []
  for (let k = desde; k <= hasta; k = addDaysKey(k, 1)) dias.push(k)
  return dias
}

const tituloRango = (vista, ancla) => {
  const mes = (key, opts) => aFecha(key).toLocaleDateString('es-CO', opts)
  if (vista === 'semana') {
    const { desde, hasta } = rangoDe('semana', ancla)
    const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7)
    return `${mes(desde, { day: 'numeric', ...(mismoMes ? {} : { month: 'short' }) })} – ${mes(hasta, { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return mes(ancla, { month: 'long', year: 'numeric' })
}

const estaEnDia = (e, key) => (e.tipo === 'torneo' ? e.fecha <= key && key <= (e.fecha_fin || e.fecha) : e.fecha === key)

const textoEstado = (e) => {
  if (e.tipo === 'reserva') {
    if (e.estado === 'pendiente') return 'Apartada, esperando pago'
    return e.pagada ? 'Confirmada · pagada' : 'Confirmada · pago pendiente'
  }
  if (e.tipo === 'partido') {
    if (e.resultado === 'ganado') return 'Jugado · ganaste'
    if (e.resultado === 'perdido') return 'Jugado · perdiste'
    return e.estado === 'jugado' ? 'Jugado' : 'Por jugar'
  }
  if (e.tipo === 'torneo') {
    return { activo: 'Inscripciones', en_curso: 'En curso', finalizado: 'Finalizado' }[e.estado] ?? e.estado
  }
  return 'Clase semanal'
}

const claseEvento = (e) => [
  'cal-evento',
  `cal-${e.tipo}`,
  e.tipo === 'reserva' && e.estado === 'pendiente' ? 'cal-sin-confirmar' : '',
  e.tipo === 'reserva' && e.estado === 'confirmada' && !e.pagada ? 'cal-sin-pagar' : '',
  e.estado === 'jugado' || e.estado === 'finalizado' ? 'cal-pasado' : ''
].filter(Boolean).join(' ')

// Columnas para eventos que se cruzan el mismo día (vista semana)
const conCarriles = (eventos) => {
  const orden = [...eventos].sort((a, b) => minutos(a.hora_inicio) - minutos(b.hora_inicio))
  const fines = []
  const items = orden.map(e => {
    let carril = fines.findIndex(fin => fin <= minutos(e.hora_inicio))
    if (carril === -1) carril = fines.length
    fines[carril] = minutos(e.hora_fin)
    return { e, carril }
  })
  return items.map(i => ({ ...i, total: fines.length }))
}

function DetalleEvento({ evento, admin, onCerrar }) {
  const t = TIPOS[evento.tipo]
  const fecha = (key) => aFecha(key).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const enlace = admin
    ? { reserva: '/admin/reservas', partido: '/admin/torneos', torneo: '/admin/torneos' }[evento.tipo]
    : { reserva: '/perfil', partido: '/torneos?seccion=partidos', torneo: '/torneos?seccion=inscripciones', clase: '/clases' }[evento.tipo]

  return (
    <div className="cal-detalle-overlay" onMouseDown={onCerrar}>
      <div className={`cal-detalle cal-borde-${evento.tipo}`} role="dialog" aria-modal="true" aria-label={evento.titulo} onMouseDown={e => e.stopPropagation()}>
        <div className="cal-detalle-head">
          <span className={`cal-detalle-tipo cal-${evento.tipo}`}>
            <i className="material-icons">{t.icon}</i>{t.label.replace(/s$/, '')}
          </span>
          <button type="button" className="cal-detalle-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <i className="material-icons">close</i>
          </button>
        </div>
        <h4>{evento.titulo}</h4>
        {evento.subtitulo && <p className="cal-detalle-sub">{evento.subtitulo}</p>}
        <ul className="cal-detalle-datos">
          <li>
            <i className="material-icons">calendar_today</i>
            {evento.tipo === 'torneo' && evento.fecha_fin && evento.fecha_fin !== evento.fecha
              ? `Del ${fecha(evento.fecha)} al ${fecha(evento.fecha_fin)}`
              : fecha(evento.fecha)}
          </li>
          {evento.hora_inicio && (
            <li>
              <i className="material-icons">schedule</i>
              {formatHour(evento.hora_inicio)} – {formatHour(evento.hora_fin)}
              {evento.tipo === 'torneo' && ' (franja de partidos)'}
            </li>
          )}
          {evento.cancha && <li><i className="material-icons">sports_tennis</i>{evento.cancha.nombre}</li>}
          {evento.canchas?.length > 0 && (
            <li><i className="material-icons">sports_tennis</i>{evento.canchas.map(c => c.nombre).join(', ')}</li>
          )}
          {evento.usuario && <li><i className="material-icons">person</i>{evento.usuario.nombre} · {evento.usuario.email}</li>}
          {evento.precio != null && <li><i className="material-icons">payments</i>{formatPrice(evento.precio)}</li>}
          <li><i className="material-icons">info</i>{textoEstado(evento)}</li>
          {evento.privado && <li><i className="material-icons">lock</i>Torneo privado (con código de acceso)</li>}
        </ul>
        {enlace && (
          <Link className="cal-detalle-link" to={enlace}>
            Ver detalle <i className="material-icons">arrow_forward</i>
          </Link>
        )}
      </div>
    </div>
  )
}

function Calendario({ admin = false }) {
  const hoy = todayKey()
  const [vista, setVista] = useState(() => (window.innerWidth < 700 ? 'lista' : 'mes'))
  const [ancla, setAncla] = useState(hoy)
  const [diaElegido, setDiaElegido] = useState(hoy)
  const [ocultos, setOcultos] = useState(() => new Set())
  const [canchaId, setCanchaId] = useState('')
  const [canchas, setCanchas] = useState([])
  const [datos, setDatos] = useState({ clave: '', eventos: [] })
  const [error, setError] = useState('')
  const [recargar, setRecargar] = useState(0)
  const [seleccionado, setSeleccionado] = useState(null)

  const { desde, hasta } = rangoDe(vista, ancla)
  const clave = `${desde}|${hasta}|${canchaId}|${recargar}`
  const cargando = datos.clave !== clave && !error

  useEffect(() => {
    if (!admin) return
    let cancelado = false
    getCanchasApi(true).then(res => { if (!cancelado) setCanchas(res.data) }).catch(() => {})
    return () => { cancelado = true }
  }, [admin])

  useEffect(() => {
    let cancelado = false
    const [d, h, c] = clave.split('|')
    getCalendarioApi(d, h, c)
      .then(res => {
        if (cancelado) return
        setDatos({ clave, eventos: res.data.eventos })
        setError('')
      })
      .catch(err => { if (!cancelado) setError(getErrorMessage(err, 'No se pudo cargar el calendario')) })
    return () => { cancelado = true }
  }, [clave])

  const eventos = useMemo(
    () => datos.eventos.filter(e => !ocultos.has(e.tipo)),
    [datos.eventos, ocultos]
  )
  const conteo = useMemo(() => {
    const c = {}
    for (const e of datos.eventos) c[e.tipo] = (c[e.tipo] ?? 0) + 1
    return c
  }, [datos.eventos])
  const tiposPresentes = Object.keys(TIPOS).filter(t => admin ? t !== 'clase' : true)

  const delDia = (key) => eventos.filter(e => estaEnDia(e, key))

  const mover = (paso) => {
    setError('')
    if (vista === 'semana') {
      setAncla(a => addDaysKey(a, paso * 7))
    } else {
      setAncla(a => {
        const d = aFecha(primeroDelMes(a))
        return aKey(new Date(d.getFullYear(), d.getMonth() + paso, 1))
      })
    }
  }

  const irAHoy = () => {
    setError('')
    setAncla(hoy)
    setDiaElegido(hoy)
  }

  const alternar = (tipo) => setOcultos(prev => {
    const nuevo = new Set(prev)
    if (nuevo.has(tipo)) nuevo.delete(tipo)
    else nuevo.add(tipo)
    return nuevo
  })

  const chip = (e, key) => (
    <button
      key={`${e.id}-${key}`}
      type="button"
      className={claseEvento(e)}
      style={e.tipo === 'clase' && e.color ? { '--cal-color': e.color } : undefined}
      onClick={(ev) => { ev.stopPropagation(); setSeleccionado(e) }}
      title={`${e.titulo}${e.subtitulo ? ` — ${e.subtitulo}` : ''}`}
    >
      {e.tipo !== 'torneo' && e.hora_inicio && <span className="cal-evento-hora">{e.hora_inicio}</span>}
      <span className="cal-evento-texto">{e.titulo}</span>
    </button>
  )

  // ─── Vista mes ───
  const vistaMes = () => {
    const dias = diasEntre(desde, hasta)
    const mesActual = ancla.slice(0, 7)
    const elegidos = delDia(diaElegido)
    return (
      <div className="cal-mes-layout">
        <div className="cal-mes">
          {DIAS_CORTOS.map(d => <div key={d} className="cal-mes-dia-semana">{d}</div>)}
          {dias.map(key => {
            const lista = delDia(key)
            const visibles = lista.slice(0, 3)
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                className={[
                  'cal-mes-celda',
                  key.slice(0, 7) !== mesActual ? 'fuera' : '',
                  key === hoy ? 'hoy' : '',
                  key === diaElegido ? 'elegido' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => setDiaElegido(key)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') setDiaElegido(key) }}
              >
                <span className="cal-mes-numero">{Number(key.slice(8))}</span>
                <div className="cal-mes-eventos">
                  {visibles.map(e => chip(e, key))}
                  {lista.length > 3 && <span className="cal-mas">+{lista.length - 3} más</span>}
                </div>
              </div>
            )
          })}
        </div>

        <aside className="cal-dia-panel">
          <h5>{aFecha(diaElegido).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</h5>
          {elegidos.length === 0 ? (
            <p className="cal-vacio">Nada programado este día.</p>
          ) : (
            <ul className="cal-agenda">
              {elegidos.map(e => (
                <li key={e.id}>
                  <button type="button" className={`cal-agenda-item cal-borde-${e.tipo}`} onClick={() => setSeleccionado(e)}>
                    <span className="cal-agenda-hora">
                      {e.tipo === 'torneo' ? 'Todo el día' : `${formatHour(e.hora_inicio)} – ${formatHour(e.hora_fin)}`}
                    </span>
                    <span className="cal-agenda-titulo">{e.titulo}</span>
                    {e.subtitulo && <span className="cal-agenda-sub">{e.subtitulo}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    )
  }

  // ─── Vista semana ───
  const vistaSemana = () => {
    const dias = diasEntre(desde, hasta)
    const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i)
    const alto = (HORA_FIN - HORA_INICIO) * PX_HORA
    const ahora = new Date()
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
    return (
      <div className="cal-semana-scroll">
        <div className="cal-semana">
          <div className="cal-semana-cabecera">
            <div className="cal-semana-esquina" />
            {dias.map((key, i) => (
              <div key={key} className={`cal-semana-dia ${key === hoy ? 'hoy' : ''}`}>
                <span>{DIAS_CORTOS[i]}</span>
                <strong>{Number(key.slice(8))}</strong>
              </div>
            ))}
          </div>

          <div className="cal-semana-todo-el-dia">
            <div className="cal-semana-esquina">Torneos</div>
            {dias.map(key => (
              <div key={key} className="cal-semana-celda-dia">
                {delDia(key).filter(e => e.tipo === 'torneo').map(e => chip(e, key))}
              </div>
            ))}
          </div>

          <div className="cal-semana-cuerpo" style={{ height: alto }}>
            <div className="cal-semana-horas">
              {horas.map(h => (
                <div key={h} className="cal-semana-hora" style={{ height: PX_HORA }}>{formatHour(`${pad(h)}:00`)}</div>
              ))}
            </div>
            {dias.map(key => (
              <div key={key} className={`cal-semana-columna ${key === hoy ? 'hoy' : ''}`}>
                {horas.map(h => <div key={h} className="cal-semana-linea" style={{ height: PX_HORA }} />)}
                {key === hoy && minAhora >= HORA_INICIO * 60 && minAhora <= HORA_FIN * 60 && (
                  <div className="cal-ahora" style={{ top: ((minAhora - HORA_INICIO * 60) / 60) * PX_HORA }} />
                )}
                {conCarriles(delDia(key).filter(e => e.tipo !== 'torneo' && e.hora_inicio)).map(({ e, carril, total }) => {
                  const ini = Math.max(minutos(e.hora_inicio), HORA_INICIO * 60)
                  const fin = Math.min(Math.max(minutos(e.hora_fin), ini + 30), HORA_FIN * 60)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`${claseEvento(e)} cal-bloque`}
                      style={{
                        top: ((ini - HORA_INICIO * 60) / 60) * PX_HORA,
                        height: Math.max(((fin - ini) / 60) * PX_HORA - 2, 20),
                        left: `calc(${(carril / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                        ...(e.tipo === 'clase' && e.color ? { '--cal-color': e.color } : {})
                      }}
                      onClick={() => setSeleccionado(e)}
                      title={`${e.titulo}${e.subtitulo ? ` — ${e.subtitulo}` : ''}`}
                    >
                      <span className="cal-evento-hora">{e.hora_inicio}–{e.hora_fin}</span>
                      <span className="cal-evento-texto">{e.titulo}</span>
                      {e.cancha && <span className="cal-evento-sub">{e.cancha.nombre}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Vista lista ───
  const vistaLista = () => {
    const dias = diasEntre(desde, hasta).filter(key => delDia(key).length > 0)
    if (!dias.length) return <p className="cal-vacio cal-vacio-grande">No hay nada programado este mes.</p>
    return (
      <div className="cal-lista">
        {dias.map(key => (
          <section key={key} className={`cal-lista-dia ${key === hoy ? 'hoy' : ''} ${key < hoy ? 'pasado' : ''}`}>
            <h6>
              <span className="cal-lista-numero">{Number(key.slice(8))}</span>
              {aFecha(key).toLocaleDateString('es-CO', { weekday: 'long', month: 'short' })}
              {key === hoy && <span className="cal-hoy-tag">Hoy</span>}
            </h6>
            <ul className="cal-agenda">
              {delDia(key).map(e => (
                <li key={e.id}>
                  <button type="button" className={`cal-agenda-item cal-borde-${e.tipo}`} onClick={() => setSeleccionado(e)}>
                    <span className="cal-agenda-hora">
                      {e.tipo === 'torneo' ? 'Todo el día' : `${formatHour(e.hora_inicio)} – ${formatHour(e.hora_fin)}`}
                    </span>
                    <span className="cal-agenda-titulo">{e.titulo}</span>
                    <span className="cal-agenda-sub">
                      {[e.subtitulo, e.cancha?.nombre, textoEstado(e)].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="cal-btn-icono" onClick={() => mover(-1)} aria-label="Anterior">
            <i className="material-icons">chevron_left</i>
          </button>
          <button type="button" className="cal-btn-hoy" onClick={irAHoy}>Hoy</button>
          <button type="button" className="cal-btn-icono" onClick={() => mover(1)} aria-label="Siguiente">
            <i className="material-icons">chevron_right</i>
          </button>
          <h3 className="cal-titulo">{tituloRango(vista, ancla)}</h3>
          {cargando && <i className="material-icons spinning cal-cargando">refresh</i>}
        </div>

        <div className="cal-vistas" role="tablist" aria-label="Vista del calendario">
          {VISTAS.map(v => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={vista === v.id}
              className={vista === v.id ? 'activo' : ''}
              onClick={() => setVista(v.id)}
            >
              <i className="material-icons">{v.icon}</i>
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cal-filtros">
        {tiposPresentes.map(tipo => (
          <button
            key={tipo}
            type="button"
            className={`cal-filtro cal-${tipo} ${ocultos.has(tipo) ? 'apagado' : ''}`}
            onClick={() => alternar(tipo)}
            aria-pressed={!ocultos.has(tipo)}
          >
            <i className="material-icons">{TIPOS[tipo].icon}</i>
            {TIPOS[tipo].label}
            <span className="cal-filtro-n">{conteo[tipo] ?? 0}</span>
          </button>
        ))}
        {admin && (
          <select
            className="browser-default cal-select"
            value={canchaId}
            onChange={e => setCanchaId(e.target.value)}
            aria-label="Filtrar por cancha"
          >
            <option value="">Todas las canchas</option>
            {canchas.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
          </select>
        )}
        <span className="cal-leyenda">
          <span className="cal-leyenda-item"><span className="cal-muestra punteada" /> Sin pagar</span>
        </span>
      </div>

      {error ? (
        <div className="cal-error" role="alert">
          <i className="material-icons">error_outline</i>
          {error}
          <button type="button" onClick={() => { setError(''); setRecargar(n => n + 1) }}>Reintentar</button>
        </div>
      ) : (
        <div className={`cal-contenido ${cargando ? 'cargando' : ''}`}>
          {vista === 'mes' && vistaMes()}
          {vista === 'semana' && vistaSemana()}
          {vista === 'lista' && vistaLista()}
        </div>
      )}

      {seleccionado && <DetalleEvento evento={seleccionado} admin={admin} onCerrar={() => setSeleccionado(null)} />}
    </div>
  )
}

export default Calendario
