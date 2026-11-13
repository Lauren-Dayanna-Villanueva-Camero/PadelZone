import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdmin } from '../../../hooks/useAdmin'
import { getEstadisticasApi, getErrorMessage } from '../../../services/api'
import { CONCEPTOS } from '../../../components/Pago/pagoUtils'
import { ErrorBanner, Loading } from '../components/AdminUI'
import {
  GraficoLinea,
  GraficoColumnas,
  BarrasRanking,
  ListaMedidores,
  MapaCalor,
  VerTabla
} from '../components/graficos/Graficos'
import { fmtCOP, fmtCOPCorto, fmtNumero, fmtPct, fmtDia, DIAS_SEMANA } from '../components/graficos/formato'
import './Dashboard.css'

const PERIODOS = [7, 30, 90]

const METODOS = { tarjeta: 'Tarjeta', pse: 'PSE', nequi: 'Nequi', efectivo: 'Efectivo', otro: 'Otro' }

const catalogo = [
  { key: 'reservas', label: 'Reservas vigentes', icon: 'event_available', to: '/admin/reservas' },
  { key: 'canchas', label: 'Canchas activas', icon: 'sports_tennis', to: '/admin/canchas' },
  { key: 'productos', label: 'Productos activos', icon: 'shopping_bag', to: '/admin/productos' },
  { key: 'torneos', label: 'Torneos activos', icon: 'emoji_events', to: '/admin/torneos' },
  { key: 'usuarios', label: 'Usuarios', icon: 'group', to: '/admin/usuarios' },
  { key: 'media', label: 'Imágenes', icon: 'photo_library', to: '/admin/media' }
]

const quickActions = [
  { to: '/admin/calendario', icon: 'calendar_month', label: 'Calendario' },
  { to: '/admin/pagos', icon: 'payments', label: 'Pagos' },
  { to: '/admin/canchas', icon: 'add_circle', label: 'Nueva cancha' },
  { to: '/admin/productos', icon: 'add_shopping_cart', label: 'Nuevo producto' },
  { to: '/admin/torneos', icon: 'emoji_events', label: 'Nuevo torneo' },
  { to: '/admin/carrusel', icon: 'add_photo_alternate', label: 'Nuevo slide' }
]

const sumarDias = (key, n) => new Date(new Date(`${key}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
const redondear1 = (n) => Math.round(n * 10) / 10

// Cambio frente al periodo anterior. Subir es bueno en todos los indicadores;
// la flecha y el signo acompañan al color (nunca solo el color)
function Delta({ actual, anterior, puntos = false, periodo }) {
  let dir = Math.sign(actual - anterior)
  let texto
  if (puntos) {
    const d = redondear1(actual - anterior)
    dir = Math.sign(d)
    texto = `${d > 0 ? '+' : ''}${fmtNumero(d)} pts`
  } else if (!anterior) {
    texto = actual ? 'Nuevo' : 'Sin cambio'
  } else {
    const p = redondear1(((actual - anterior) / anterior) * 100)
    dir = Math.sign(p)
    texto = `${p > 0 ? '+' : ''}${fmtNumero(p)} %`
  }
  const clase = dir > 0 ? 'sube' : dir < 0 ? 'baja' : 'igual'
  const icono = dir > 0 ? 'arrow_upward' : dir < 0 ? 'arrow_downward' : 'remove'
  return (
    <span className={`dash-delta dash-delta--${clase}`}>
      <span className="dash-delta-valor">
        <i className="material-icons" aria-hidden="true">{icono}</i>
        {texto}
      </span>
      <span className="dash-delta-ref">vs. {periodo}</span>
    </span>
  )
}

function Kpi({ label, valor, detalle, hero = false, children }) {
  return (
    <div className={`dash-kpi ${hero ? 'dash-kpi--hero' : ''}`}>
      <span className="dash-kpi-label">{label}</span>
      <span className="dash-kpi-valor">{valor}</span>
      {detalle && <span className="dash-kpi-detalle">{detalle}</span>}
      {children}
    </div>
  )
}

function Tarjeta({ titulo, subtitulo, accion, className = '', children }) {
  return (
    <section className={`dash-card ${className}`}>
      <header className="dash-card-head">
        <div>
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  )
}

// Lo que el admin tiene que resolver; solo se listan los que tienen algo
function ParaAtender({ pendientes }) {
  const items = [
    {
      n: pendientes.efectivo.cantidad,
      texto: pendientes.efectivo.cantidad === 1 ? 'pago en efectivo por confirmar' : 'pagos en efectivo por confirmar',
      extra: pendientes.efectivo.cantidad ? fmtCOP(pendientes.efectivo.monto) : '',
      icon: 'payments',
      nivel: 'warning',
      to: '/admin/pagos?ver=efectivo'
    },
    {
      n: pendientes.reembolsos,
      texto: pendientes.reembolsos === 1 ? 'pago por reembolsar' : 'pagos por reembolsar',
      extra: 'Pagados pero cancelados',
      icon: 'currency_exchange',
      nivel: 'critical',
      to: '/admin/pagos?ver=reembolsos'
    },
    {
      n: pendientes.pedidos,
      texto: pendientes.pedidos === 1 ? 'pedido pendiente' : 'pedidos pendientes',
      extra: 'Por despachar o cobrar',
      icon: 'local_shipping',
      nivel: 'warning',
      to: '/admin/pedidos'
    },
    {
      n: pendientes.solicitudes,
      texto: pendientes.solicitudes === 1 ? 'solicitud de torneo' : 'solicitudes de torneo',
      extra: 'De empresas, por aprobar',
      icon: 'business',
      nivel: 'warning',
      to: '/admin/torneos?vista=solicitudes'
    },
    {
      n: pendientes.reservas_esperando_pago,
      texto: pendientes.reservas_esperando_pago === 1 ? 'reserva esperando pago' : 'reservas esperando pago',
      extra: 'Se liberan a los 15 min',
      icon: 'hourglass_top',
      nivel: 'warning',
      to: '/admin/reservas'
    }
  ].filter(i => i.n > 0)

  if (!items.length) {
    return (
      <p className="dash-al-dia">
        <i className="material-icons" aria-hidden="true">check_circle</i>
        Todo al día: no hay nada pendiente.
      </p>
    )
  }

  return (
    <ul className="dash-atender">
      {items.map(i => (
        <li key={i.to}>
          <Link to={i.to} className={`dash-atender-item dash-atender-item--${i.nivel}`}>
            <i className="material-icons dash-atender-icono" aria-hidden="true">{i.icon}</i>
            <span className="dash-atender-texto">
              <span><strong>{i.n}</strong> {i.texto}</span>
              <small>{i.extra}</small>
            </span>
            <i className="material-icons dash-atender-ir" aria-hidden="true">chevron_right</i>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AgendaHoy({ hoy }) {
  return (
    <>
      <p className="dash-hoy-resumen">
        <strong>{hoy.reservas.length}</strong> {hoy.reservas.length === 1 ? 'reserva' : 'reservas'}
        {' · '}
        <strong>{hoy.partidos}</strong> {hoy.partidos === 1 ? 'partido de torneo' : 'partidos de torneo'}
      </p>
      {hoy.reservas.length === 0 ? (
        <p className="graf-vacio">No hay reservas para hoy.</p>
      ) : (
        <ul className="dash-hoy">
          {hoy.reservas.slice(0, 8).map(r => (
            <li key={r._id}>
              <span className="dash-hoy-hora">{r.hora_inicio}–{r.hora_fin}</span>
              <span className="dash-hoy-quien">
                <strong>{r.cancha}</strong>
                <small>{r.cliente}</small>
              </span>
              <span className={`dash-chip ${r.pagada ? 'dash-chip--ok' : 'dash-chip--pend'}`}>
                <i className="material-icons" aria-hidden="true">{r.pagada ? 'check_circle' : 'schedule'}</i>
                {r.pagada ? 'Pagada' : r.estado === 'pendiente' ? 'Esperando pago' : 'Por pagar'}
              </span>
            </li>
          ))}
          {hoy.reservas.length > 8 && (
            <li className="dash-hoy-mas">y {hoy.reservas.length - 8} más en el calendario</li>
          )}
        </ul>
      )}
    </>
  )
}

function Dashboard() {
  const { stats, loading: cargandoStats, error: errorStats } = useAdmin()
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    getEstadisticasApi(dias)
      .then(res => {
        if (cancelado) return
        setDatos(res.data)
        setError('')
      })
      .catch(err => { if (!cancelado) setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas')) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [dias, intento])

  const cambiarPeriodo = (d) => {
    if (d === dias) return
    setCargando(true)
    setDias(d)
  }

  const periodoTexto = `${dias} días anteriores`
  const k = datos?.kpis

  // Serie para la línea: actual y anterior alineados día a día
  const serieLinea = datos?.serie.map(s => ({
    dia: s.dia,
    dia_anterior: sumarDias(s.dia, -datos.periodo.dias),
    actual: s.ingresos,
    anterior: s.ingresos_anterior
  })) ?? []

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>
          {datos
            ? `Resumen del ${fmtDia(datos.periodo.desde, { day: 'numeric', month: 'long' })} al ${fmtDia(datos.periodo.hasta, { day: 'numeric', month: 'long' })}`
            : 'Resumen del club'}
        </p>
      </div>

      {/* Un solo filtro, arriba de todo: aplica a todos los indicadores y gráficos */}
      <div className="dash-filtros" role="radiogroup" aria-label="Periodo">
        {PERIODOS.map(d => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={dias === d}
            className={dias === d ? 'is-activo' : ''}
            onClick={() => cambiarPeriodo(d)}
          >
            {dias === d && <i className="material-icons" aria-hidden="true">check</i>}
            Últimos {d} días
          </button>
        ))}
        {cargando && datos && <span className="dash-actualizando">Actualizando…</span>}
      </div>

      <ErrorBanner message={error} onRetry={() => { setCargando(true); setIntento(i => i + 1) }} />

      {!datos && cargando && <Loading text="Cargando estadísticas..." />}

      {datos && (
        <div className={`dash-contenido ${cargando ? 'is-recargando' : ''}`}>
          <div className="dash-kpis">
            <Kpi
              hero
              label="Ingresos"
              valor={fmtCOPCorto(k.ingresos.actual)}
              detalle={`${fmtCOP(k.ingresos.actual)} · ticket promedio ${fmtCOP(k.ticket_promedio)}`}
            >
              <Delta actual={k.ingresos.actual} anterior={k.ingresos.anterior} periodo={periodoTexto} />
            </Kpi>
            <Kpi label="Reservas" valor={fmtNumero(k.reservas.actual)} detalle="Sin contar las canceladas">
              <Delta actual={k.reservas.actual} anterior={k.reservas.anterior} periodo={periodoTexto} />
            </Kpi>
            <Kpi label="Ocupación de canchas" valor={fmtPct(k.ocupacion.actual)} detalle="Horas reservadas de 7:00 a 23:00">
              <Delta actual={k.ocupacion.actual} anterior={k.ocupacion.anterior} puntos periodo={periodoTexto} />
            </Kpi>
            <Kpi label="Usuarios nuevos" valor={fmtNumero(k.usuarios_nuevos.actual)} detalle={`${fmtNumero(k.pedidos)} pedidos en la tienda`}>
              <Delta actual={k.usuarios_nuevos.actual} anterior={k.usuarios_nuevos.anterior} periodo={periodoTexto} />
            </Kpi>
          </div>

          <div className="dash-grid">
            <Tarjeta
              className="dash-span-2"
              titulo="Ingresos por día"
              subtitulo="Pagos aprobados de reservas, tienda, torneos y clases (hoy va en curso)"
              accion={(
                <div className="dash-leyenda" aria-hidden="true">
                  <span><i className="graf-key" /> Últimos {dias} días</span>
                  <span><i className="graf-key graf-key--contexto" /> {dias} días anteriores</span>
                </div>
              )}
            >
              <GraficoLinea
                datos={serieLinea}
                nombreActual="este periodo"
                nombreAnterior="periodo anterior"
                diaEnCurso={datos.periodo.hasta}
                descripcion={`Ingresos por día de los últimos ${dias} días comparados con los ${dias} anteriores. Usa las flechas para recorrer los días.`}
              />
              <VerTabla
                columnas={['Día', 'Ingresos', 'Periodo anterior', 'Reservas']}
                filas={datos.serie.map(s => [fmtDia(s.dia, { weekday: 'short', day: 'numeric', month: 'short' }), fmtCOP(s.ingresos), fmtCOP(s.ingresos_anterior), s.reservas])}
              />
            </Tarjeta>

            <Tarjeta titulo="Para atender" subtitulo="Ahora mismo, sin importar el periodo">
              <ParaAtender pendientes={datos.pendientes} />
            </Tarjeta>

            <Tarjeta className="dash-span-2" titulo="Reservas por día" subtitulo="Por fecha de juego, sin contar las canceladas">
              <GraficoColumnas
                datos={datos.serie.map(s => ({ dia: s.dia, valor: s.reservas }))}
                etiqueta="reservas"
                alto={280}
                diaEnCurso={datos.periodo.hasta}
                descripcion={`Reservas por día de los últimos ${dias} días. Usa las flechas para recorrer los días.`}
              />
            </Tarjeta>

            <Tarjeta titulo="¿De dónde vienen los ingresos?">
              <BarrasRanking
                filas={datos.ingresos_por_concepto.map(c => ({ clave: c.concepto, nombre: CONCEPTOS[c.concepto]?.label ?? c.concepto, valor: c.total }))}
                formato={fmtCOPCorto}
              />
              <h3 className="dash-subtitulo">Por método de pago</h3>
              <BarrasRanking
                filas={datos.ingresos_por_metodo.map(m => ({ clave: m.metodo, nombre: METODOS[m.metodo] ?? m.metodo, valor: m.total }))}
                formato={fmtCOPCorto}
              />
            </Tarjeta>

            <Tarjeta className="dash-span-2" titulo="Horarios más ocupados" subtitulo="Porcentaje de las canchas reservado por día de la semana y hora">
              <MapaCalor horas={datos.heatmap.horas} filas={datos.heatmap.filas} />
              <VerTabla
                columnas={['Hora', ...DIAS_SEMANA.map(d => d.slice(0, 3))]}
                filas={datos.heatmap.horas.map((h, i) => [`${h}:00`, ...datos.heatmap.filas.map(f => fmtPct(f[i].pct))])}
              />
            </Tarjeta>

            <Tarjeta titulo="Ocupación por cancha" subtitulo={`Horas reservadas de ${fmtNumero(16 * dias)} posibles`}>
              <ListaMedidores
                filas={datos.ocupacion_canchas.map(c => ({ clave: c._id, nombre: c.nombre, pct: c.pct, detalle: `${fmtNumero(c.horas)} h` }))}
              />
            </Tarjeta>

            <Tarjeta
              titulo={`Hoy, ${fmtDia(datos.hoy.dia, { weekday: 'long', day: 'numeric', month: 'long' })}`}
              accion={<Link to="/admin/calendario" className="dash-link">Ver calendario <i className="material-icons" aria-hidden="true">chevron_right</i></Link>}
            >
              <AgendaHoy hoy={datos.hoy} />
            </Tarjeta>

            <Tarjeta titulo="Más vendidos en la tienda" subtitulo="Unidades, sin contar pedidos cancelados">
              <BarrasRanking
                filas={datos.top_productos.map(p => ({ clave: p.nombre, nombre: p.nombre, valor: p.unidades, detalle: fmtCOP(p.total) }))}
                formato={n => `${fmtNumero(n)} und.`}
                vacio="No hubo ventas en este periodo"
              />
            </Tarjeta>

            <Tarjeta titulo="Acciones rápidas">
              <div className="dashboard-actions">
                {quickActions.map(action => (
                  <Link key={action.to + action.label} to={action.to} className="dashboard-action-btn">
                    <i className="material-icons" aria-hidden="true">{action.icon}</i>
                    {action.label}
                  </Link>
                ))}
              </div>
            </Tarjeta>
          </div>
        </div>
      )}

      <section className="dash-catalogo" aria-label="Catálogo">
        {catalogo.map(c => (
          <Link to={c.to} key={c.key} className="dash-catalogo-item">
            <i className="material-icons" aria-hidden="true">{c.icon}</i>
            <strong>{cargandoStats ? '…' : errorStats ? '—' : fmtNumero(stats[c.key] ?? 0)}</strong>
            <span>{c.label}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}

export default Dashboard
