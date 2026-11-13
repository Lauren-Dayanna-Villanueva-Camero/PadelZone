import { useRef, useState } from 'react'
import { fmtCOP, fmtCOPCorto, fmtNumero, fmtPct, fmtDia, DIAS_SEMANA, useAncho } from './formato'
import './Graficos.css'

// Gráficos del dashboard en SVG/HTML, sin librerías. Un solo tono (azul) para
// los datos, gris para el contexto (periodo anterior), cuadrícula de líneas
// finas y un tooltip al pasar el mouse o con el teclado (flechas).

// ─── Utilidades ─────────────────────────────────────

// Marcas redondas del eje Y: 0 y 3-5 pasos "limpios" (1, 2, 2.5, 5 × 10^n)
const ticksY = (max, cantidad = 4) => {
  if (max <= 0) return [0, 1]
  const bruto = max / cantidad
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map(f => f * potencia).find(p => p >= bruto)
  const ticks = []
  for (let v = 0; v < max + paso * 0.999; v += paso) ticks.push(v)
  return ticks
}

// Índices de las fechas que se rotulan en el eje X (unas 6, siempre la última)
const indicesEtiquetas = (n, maximo = 6) => {
  const cada = Math.max(1, Math.ceil(n / maximo))
  const lista = []
  for (let i = n - 1; i >= 0; i -= cada) lista.unshift(i)
  return lista
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

// Teclado: flechas para moverse por los puntos de un gráfico
const manejarTeclas = (e, activo, setActivo, n) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  const actual = activo ?? n - 1
  if (e.key === 'ArrowLeft') setActivo(limitar(actual - 1, 0, n - 1))
  if (e.key === 'ArrowRight') setActivo(limitar(actual + 1, 0, n - 1))
  if (e.key === 'Home') setActivo(0)
  if (e.key === 'End') setActivo(n - 1)
}

// Tooltip junto al punto; se voltea hacia la izquierda cerca del borde derecho
function Tooltip({ x, y, ancho, children }) {
  const izquierda = x > ancho * 0.62
  return (
    <div
      className={`graf-tooltip ${izquierda ? 'graf-tooltip--izq' : ''}`}
      style={{ left: x, top: y }}
      role="status"
    >
      {children}
    </div>
  )
}

const M = { t: 12, r: 16, b: 28, l: 60 }

function EjeY({ ticks, y, x1, x2, formato }) {
  return ticks.map(t => (
    <g key={t}>
      <line x1={x1} x2={x2} y1={y(t)} y2={y(t)} className={t === 0 ? 'graf-base' : 'graf-grid'} />
      <text x={x1 - 8} y={y(t)} dy="0.32em" textAnchor="end" className="graf-eje">{formato(t)}</text>
    </g>
  ))
}

function EjeX({ datos, x, y0 }) {
  return indicesEtiquetas(datos.length).map(i => (
    <text key={datos[i].dia} x={x(i)} y={y0 + 18} textAnchor="middle" className="graf-eje">
      {fmtDia(datos[i].dia)}
    </text>
  ))
}

// ─── Línea: periodo actual (azul) vs. anterior (gris) ───

export function GraficoLinea({ datos, alto = 250, nombreActual, nombreAnterior, formato = fmtCOP, formatoEje = fmtCOPCorto, descripcion, diaEnCurso }) {
  const ref = useRef(null)
  const ancho = useAncho(ref)
  const [activo, setActivo] = useState(null)
  const n = datos.length

  const w = Math.max(0, ancho - M.l - M.r)
  const h = alto - M.t - M.b
  const ticks = ticksY(Math.max(1, ...datos.flatMap(d => [d.actual, d.anterior])))
  const tope = ticks[ticks.length - 1]
  const x = (i) => M.l + (n <= 1 ? w / 2 : (i * w) / (n - 1))
  const y = (v) => M.t + h - (v / tope) * h
  const trazo = (clave) => datos.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[clave]).toFixed(1)}`).join('')
  const area = n ? `${trazo('actual')}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : ''

  const alMover = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left - M.l
    setActivo(limitar(Math.round(n <= 1 ? 0 : (px / w) * (n - 1)), 0, n - 1))
  }
  const d = activo != null ? datos[activo] : null

  return (
    <div
      className="graf"
      ref={ref}
      tabIndex={0}
      aria-label={descripcion}
      onKeyDown={e => manejarTeclas(e, activo, setActivo, n)}
      onBlur={() => setActivo(null)}
    >
      {ancho > 0 && n > 0 && (
        <svg width={ancho} height={alto} aria-hidden="true">
          <EjeY ticks={ticks} y={y} x1={M.l} x2={ancho - M.r} formato={formatoEje} />
          <EjeX datos={datos} x={x} y0={y(0)} />
          <path d={area} className="graf-area" />
          <path d={trazo('anterior')} className="graf-linea graf-linea--contexto" />
          <path d={trazo('actual')} className="graf-linea" />
          {activo == null && <circle cx={x(n - 1)} cy={y(datos[n - 1].actual)} r={4} className="graf-punto" />}
          {d && (
            <g>
              <line x1={x(activo)} x2={x(activo)} y1={M.t} y2={y(0)} className="graf-cruz" />
              <circle cx={x(activo)} cy={y(d.anterior)} r={4} className="graf-punto graf-punto--contexto" />
              <circle cx={x(activo)} cy={y(d.actual)} r={4} className="graf-punto" />
            </g>
          )}
          <rect
            x={M.l} y={M.t} width={w} height={h} fill="transparent"
            onPointerMove={alMover}
            onPointerLeave={() => setActivo(null)}
          />
        </svg>
      )}
      {d && (
        <Tooltip x={x(activo)} y={M.t} ancho={ancho}>
          <span className="graf-tooltip-titulo">
            {fmtDia(d.dia, { weekday: 'long', day: 'numeric', month: 'long' })}
            {d.dia === diaEnCurso ? ' · hoy, en curso' : ''}
          </span>
          <span className="graf-tooltip-fila">
            <i className="graf-key" />
            <strong>{formato(d.actual)}</strong>
            <span>{nombreActual}</span>
          </span>
          <span className="graf-tooltip-fila">
            <i className="graf-key graf-key--contexto" />
            <strong>{formato(d.anterior)}</strong>
            <span>{nombreAnterior}{d.dia_anterior ? ` (${fmtDia(d.dia_anterior)})` : ''}</span>
          </span>
        </Tooltip>
      )}
    </div>
  )
}

// ─── Columnas: una serie por día ───

export function GraficoColumnas({ datos, alto = 200, etiqueta, formato = fmtNumero, descripcion, diaEnCurso }) {
  const ref = useRef(null)
  const ancho = useAncho(ref)
  const [activo, setActivo] = useState(null)
  const n = datos.length

  const w = Math.max(0, ancho - M.l - M.r)
  const h = alto - M.t - M.b
  const ticks = ticksY(Math.max(1, ...datos.map(d => d.valor)), 3)
  const tope = ticks[ticks.length - 1]
  const banda = n ? w / n : 0
  const barra = Math.max(1, Math.min(24, banda - 2))
  const xBanda = (i) => M.l + i * banda
  const xCentro = (i) => xBanda(i) + banda / 2
  const y = (v) => M.t + h - (v / tope) * h

  // Columna con las esquinas de arriba redondeadas (4px) y la base recta
  const columna = (i, v) => {
    const alto0 = y(0) - y(v)
    if (alto0 <= 0) return ''
    const r = Math.min(4, alto0, barra / 2)
    const x0 = xCentro(i) - barra / 2
    const x1 = x0 + barra
    const yTop = y(v)
    return `M${x0},${y(0)}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x1 - r}Q${x1},${yTop} ${x1},${yTop + r}V${y(0)}Z`
  }
  const d = activo != null ? datos[activo] : null

  return (
    <div
      className="graf"
      ref={ref}
      tabIndex={0}
      aria-label={descripcion}
      onKeyDown={e => manejarTeclas(e, activo, setActivo, n)}
      onBlur={() => setActivo(null)}
    >
      {ancho > 0 && n > 0 && (
        <svg width={ancho} height={alto} aria-hidden="true">
          <EjeY ticks={ticks} y={y} x1={M.l} x2={ancho - M.r} formato={fmtNumero} />
          <EjeX datos={datos} x={xCentro} y0={y(0)} />
          {datos.map((dato, i) => (
            <path key={dato.dia} d={columna(i, dato.valor)} className={`graf-columna ${activo === i ? 'is-activa' : ''}`} />
          ))}
          {datos.map((dato, i) => (
            <rect
              key={`hit-${dato.dia}`}
              x={xBanda(i)} y={M.t} width={banda} height={h} fill="transparent"
              onPointerEnter={() => setActivo(i)}
              onPointerLeave={() => setActivo(null)}
            />
          ))}
        </svg>
      )}
      {d && (
        <Tooltip x={xCentro(activo)} y={Math.max(M.t, y(d.valor) - 8)} ancho={ancho}>
          <span className="graf-tooltip-titulo">
            {fmtDia(d.dia, { weekday: 'long', day: 'numeric', month: 'long' })}
            {d.dia === diaEnCurso ? ' · hoy' : ''}
          </span>
          <span className="graf-tooltip-fila">
            <strong>{formato(d.valor)}</strong>
            <span>{etiqueta}</span>
          </span>
        </Tooltip>
      )}
    </div>
  )
}

// ─── Barras horizontales ordenadas (mayor primero), un solo tono ───
// filas: [{ clave, nombre, valor, detalle? }]

export function BarrasRanking({ filas, formato = fmtCOP, vacio = 'Sin datos en este periodo' }) {
  const max = Math.max(0, ...filas.map(f => f.valor))
  const total = filas.reduce((s, f) => s + f.valor, 0)
  if (!max) return <p className="graf-vacio">{vacio}</p>
  return (
    <ul className="graf-ranking">
      {filas.map(f => (
        <li key={f.clave} title={`${f.nombre}: ${formato(f.valor)}`}>
          <span className="graf-ranking-nombre">{f.nombre}</span>
          <span className="graf-ranking-pista">
            <span className="graf-ranking-barra" style={{ width: `${(f.valor / max) * 100}%` }} />
          </span>
          <span className="graf-ranking-valor">
            <strong>{formato(f.valor)}</strong>
            <small>{f.detalle ?? (total ? fmtPct((f.valor / total) * 100) : '')}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── Medidores: una proporción por fila (relleno y pista del mismo tono) ───
// filas: [{ clave, nombre, pct, detalle }]

export function ListaMedidores({ filas }) {
  return (
    <ul className="graf-medidores">
      {filas.map(f => (
        <li key={f.clave}>
          <span className="graf-medidor-nombre">{f.nombre}</span>
          <span
            className="graf-medidor-pista"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={f.pct}
            aria-label={`${f.nombre}: ${fmtPct(f.pct)}`}
          >
            <span className="graf-medidor-relleno" style={{ width: `${Math.min(100, f.pct)}%` }} />
          </span>
          <span className="graf-medidor-valor">
            <strong>{fmtPct(f.pct)}</strong>
            <small>{f.detalle}</small>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── Mapa de calor: día de la semana × hora (ocupación en %) ───

// Escala secuencial de un solo tono (más oscuro = más ocupado)
const ESCALA = [
  { desde: 80, color: '#0d366b', texto: '80 %+' },
  { desde: 60, color: '#184f95', texto: '60 %' },
  { desde: 45, color: '#256abf', texto: '45 %' },
  { desde: 30, color: '#3987e5', texto: '30 %' },
  { desde: 20, color: '#6da7ec', texto: '20 %' },
  { desde: 10, color: '#9ec5f4', texto: '10 %' },
  { desde: 0.01, color: '#cde2fb', texto: '1 %' }
]
const SIN_RESERVAS = '#f1f0ec'
const colorDe = (pct) => (pct > 0 ? ESCALA.find(e => pct >= e.desde)?.color ?? ESCALA[ESCALA.length - 1].color : SIN_RESERVAS)

const horaCorta = (h) => `${h > 12 ? h - 12 : h}${h >= 12 ? 'p' : 'a'}`
const rangoHora = (h) => `${h}:00–${h + 1}:00`

export function MapaCalor({ horas, filas }) {
  const ref = useRef(null)
  const [activo, setActivo] = useState(null) // { dia, i, x, y }

  const entrar = (e, dia, i) => {
    const caja = ref.current.getBoundingClientRect()
    const celda = e.currentTarget.getBoundingClientRect()
    setActivo({ dia, i, x: celda.left - caja.left + celda.width / 2, y: celda.top - caja.top - 6 })
  }
  const c = activo ? filas[activo.dia][activo.i] : null

  return (
    <div className="graf-calor-wrap" ref={ref}>
      <div className="graf-calor" style={{ gridTemplateColumns: `44px repeat(${horas.length}, minmax(0, 1fr))` }} aria-hidden="true">
        <span />
        {horas.map(h => (
          <span key={h} className="graf-calor-hora">{h % 2 === 1 ? horaCorta(h) : ''}</span>
        ))}
        {filas.map((fila, dia) => [
          <span key={`d${dia}`} className="graf-calor-dia">{DIAS_SEMANA[dia].slice(0, 3)}</span>,
          ...fila.map((celda, i) => (
            <span
              key={`${dia}-${i}`}
              className={`graf-calor-celda ${activo?.dia === dia && activo?.i === i ? 'is-activa' : ''}`}
              style={{ background: colorDe(celda.pct) }}
              onPointerEnter={e => entrar(e, dia, i)}
              onPointerLeave={() => setActivo(null)}
            />
          ))
        ])}
      </div>
      {c && (
        <div className="graf-tooltip graf-tooltip--arriba" style={{ left: activo.x, top: activo.y }} role="status">
          <span className="graf-tooltip-titulo">{DIAS_SEMANA[activo.dia]} · {rangoHora(c.hora)}</span>
          <span className="graf-tooltip-fila">
            <strong>{fmtPct(c.pct)}</strong>
            <span>ocupado · {fmtNumero(c.horas)} h reservadas</span>
          </span>
        </div>
      )}
      <div className="graf-calor-leyenda" aria-hidden="true">
        <span>Menos</span>
        <i style={{ background: SIN_RESERVAS }} title="Sin reservas" />
        {[...ESCALA].reverse().map(e => <i key={e.color} style={{ background: e.color }} title={`Desde ${e.texto}`} />)}
        <span>Más ocupado</span>
      </div>
    </div>
  )
}

// Tabla con los datos de un gráfico (accesible sin mouse ni colores)
export function VerTabla({ titulo = 'Ver datos en tabla', columnas, filas }) {
  return (
    <details className="graf-tabla">
      <summary>{titulo}</summary>
      <div className="graf-tabla-scroll">
        <table>
          <thead>
            <tr>{columnas.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>{f.map((v, j) => <td key={j}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
