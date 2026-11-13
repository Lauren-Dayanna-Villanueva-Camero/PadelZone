import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPagosApi, confirmarPagoApi, anularPagoApi, getErrorMessage } from '../../../services/api'
import { formatPrice } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { CONCEPTOS, ESTADOS_PAGO, textoMetodo, formatFechaHora } from '../../../components/Pago/pagoUtils'
import { PageHeader, ErrorBanner, Loading, EmptyState, Modal, Field } from '../components/AdminUI'
import './Pagos.css'

const estadoTone = { aprobado: 'ok', pendiente: 'warn', rechazado: 'danger', anulado: 'off' }
const proveedores = { wompi: 'Wompi', simulado: 'Simulado', manual: 'Manual' }
const filtrosVacios = { estado: '', concepto: '', metodo: '', desde: '', hasta: '', q: '' }

function Pagos() {
  const { loadStats } = useAdmin()
  // Enlaces del dashboard: ?ver=efectivo (por confirmar) o ?ver=reembolsos
  const [searchParams] = useSearchParams()
  const ver = searchParams.get('ver')
  const [filtros, setFiltros] = useState(() => (ver === 'efectivo' ? { ...filtrosVacios, estado: 'pendiente', metodo: 'efectivo' } : filtrosVacios))
  const [data, setData] = useState({ pagos: [], resumen: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [soloReembolso, setSoloReembolso] = useState(ver === 'reembolsos')

  const [detalle, setDetalle] = useState(null)
  const [anular, setAnular] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [accionError, setAccionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async (isCancelled = () => false) => {
    setLoading(true)
    setError('')
    try {
      const limpios = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      const res = await getPagosApi(soloReembolso ? { ...limpios, reembolso: 1 } : limpios)
      if (!isCancelled()) setData(res.data)
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, 'No se pudieron cargar los pagos'))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [filtros, soloReembolso])

  useEffect(() => {
    let cancelled = false
    // Pequeña espera para no consultar en cada tecla del buscador
    const t = setTimeout(() => cargar(() => cancelled), 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [cargar])

  const set = (campo) => (e) => setFiltros(f => ({ ...f, [campo]: e.target.value }))
  const { pagos, resumen } = data
  // Con soloReembolso el servidor ya devuelve solo los pagos por reembolsar
  const visibles = pagos
  const verEfectivo = !soloReembolso && filtros.estado === 'pendiente' && filtros.metodo === 'efectivo'

  const confirmar = async (pago) => {
    setBusy(true)
    setAccionError('')
    try {
      await confirmarPagoApi(pago._id)
      setDetalle(null)
      setAviso(`Pago ${pago.referencia} confirmado`)
      cargar()
      loadStats()
    } catch (err) {
      setAccionError(getErrorMessage(err, 'No se pudo confirmar el pago'))
    } finally {
      setBusy(false)
    }
  }

  const enviarAnulacion = async () => {
    setBusy(true)
    setAccionError('')
    try {
      await anularPagoApi(anular._id, motivo.trim())
      setAviso(`Pago ${anular.referencia} anulado`)
      setAnular(null)
      setDetalle(null)
      cargar()
      loadStats()
    } catch (err) {
      setAccionError(getErrorMessage(err, 'No se pudo anular el pago'))
    } finally {
      setBusy(false)
    }
  }

  const abrirAnular = (pago) => {
    setAccionError('')
    setMotivo(pago.requiere_reembolso ? 'Reembolso: se canceló lo que se había pagado' : '')
    setAnular(pago)
  }

  const cliente = (p) => p.usuario_id ? `${p.usuario_id.nombre} ${p.usuario_id.apellido ?? ''}`.trim() : 'Usuario eliminado'

  return (
    <div>
      <PageHeader
        title="Pagos"
        subtitle="Pagos en línea, en efectivo y reembolsos de reservas, tienda, torneos y clases"
      />

      {aviso && (
        <div className="adm-alert adm-alert--ok" role="status">
          <i className="material-icons">check_circle</i>
          <span>{aviso}</span>
          <button type="button" className="adm-icon-btn" onClick={() => setAviso('')} aria-label="Cerrar aviso">
            <i className="material-icons">close</i>
          </button>
        </div>
      )}

      {resumen && (
        <div className="pagos-resumen">
          <div className="pagos-kpi">
            <span className="pagos-kpi-label">Recaudado</span>
            <strong>{formatPrice(resumen.total_aprobado)}</strong>
            <span className="adm-muted">{resumen.cantidad_aprobados} pagos aprobados</span>
          </div>
          <button
            type="button"
            className={`pagos-kpi pagos-kpi--warn ${verEfectivo ? 'activo' : ''}`}
            onClick={() => {
              setSoloReembolso(false)
              setFiltros(verEfectivo ? filtrosVacios : { ...filtrosVacios, estado: 'pendiente', metodo: 'efectivo' })
            }}
          >
            <span className="pagos-kpi-label">Efectivo por confirmar</span>
            <strong>{formatPrice(resumen.monto_pendiente_efectivo)}</strong>
            <span className="adm-muted">{resumen.pendientes_efectivo} pagos en la sede o contraentrega</span>
          </button>
          <button
            type="button"
            className={`pagos-kpi pagos-kpi--danger ${soloReembolso ? 'activo' : ''}`}
            onClick={() => {
              // Los reembolsos son pagos aprobados: los filtros de estado/método los ocultarían
              if (!soloReembolso) setFiltros(filtrosVacios)
              setSoloReembolso(v => !v)
            }}
          >
            <span className="pagos-kpi-label">Por reembolsar</span>
            <strong>{resumen.por_reembolsar}</strong>
            <span className="adm-muted">Pagados pero cancelados</span>
          </button>
          <div className="pagos-kpi pagos-metodos">
            <span className="pagos-kpi-label">Por método</span>
            {Object.keys(resumen.por_metodo).length === 0 ? <span className="adm-muted">Sin pagos aprobados</span> : (
              Object.entries(resumen.por_metodo).sort((a, b) => b[1] - a[1]).map(([m, v]) => {
                const pct = resumen.total_aprobado ? Math.round((v / resumen.total_aprobado) * 100) : 0
                return (
                  <div key={m} className="pagos-barra">
                    <span>{textoMetodo({ metodo: m }).replace(' (en la sede)', '')}</span>
                    <div className="pagos-barra-fondo"><div style={{ width: `${pct}%` }} /></div>
                    <span className="pagos-barra-valor">{formatPrice(v)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <div className="adm-toolbar pagos-filtros">
        <input type="search" placeholder="Buscar referencia (PZ-...)" value={filtros.q} onChange={set('q')} />
        <select value={filtros.estado} onChange={set('estado')} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtros.concepto} onChange={set('concepto')} aria-label="Concepto">
          <option value="">Todos los conceptos</option>
          {Object.entries(CONCEPTOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtros.metodo} onChange={set('metodo')} aria-label="Método">
          <option value="">Todos los métodos</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="pse">PSE</option>
          <option value="nequi">Nequi</option>
          <option value="efectivo">Efectivo</option>
          <option value="otro">Otro</option>
        </select>
        <input type="date" value={filtros.desde} onChange={set('desde')} aria-label="Desde" style={{ minWidth: 0 }} />
        <input type="date" value={filtros.hasta} onChange={set('hasta')} aria-label="Hasta" style={{ minWidth: 0 }} />
        {(Object.values(filtros).some(Boolean) || soloReembolso) && (
          <button className="adm-btn adm-btn--ghost adm-btn--small" onClick={() => { setFiltros(filtrosVacios); setSoloReembolso(false) }}>
            Quitar filtros
          </button>
        )}
      </div>

      <ErrorBanner message={error} onRetry={() => cargar()} />

      <div className="adm-card">
        {loading && !pagos.length ? <Loading /> : visibles.length === 0 ? (
          <EmptyState icon="payments" text="No hay pagos con estos filtros." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th>Concepto</th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => (
                  <tr key={p._id} className={['rechazado', 'anulado'].includes(p.estado) ? 'is-inactive' : ''}>
                    <td>{formatFechaHora(p.createdAt)}</td>
                    <td><code className="pagos-ref">{p.referencia}</code></td>
                    <td>
                      <span className="pagos-concepto">
                        <i className="material-icons">{CONCEPTOS[p.concepto]?.icon}</i>
                        {CONCEPTOS[p.concepto]?.label}
                      </span>
                      <div className="adm-muted">{p.descripcion}</div>
                    </td>
                    <td>
                      {cliente(p)}
                      <div className="adm-muted">{p.usuario_id?.email}</div>
                    </td>
                    <td>
                      {textoMetodo(p)}
                      <div className="adm-muted">{proveedores[p.proveedor]}</div>
                    </td>
                    <td><strong>{formatPrice(p.monto)}</strong></td>
                    <td>
                      <span className={`adm-badge adm-badge--${estadoTone[p.estado]}`}>{ESTADOS_PAGO[p.estado]?.label}</span>
                      {p.requiere_reembolso && <div><span className="adm-badge adm-badge--danger">Reembolsar</span></div>}
                    </td>
                    <td className="adm-actions">
                      <button className="adm-icon-btn" title="Ver detalle" onClick={() => { setAccionError(''); setDetalle(p) }}>
                        <i className="material-icons">receipt_long</i>
                      </button>
                      {p.estado === 'pendiente' && p.proveedor === 'manual' && (
                        <button className="adm-icon-btn" title="Confirmar pago recibido" onClick={() => confirmar(p)} disabled={busy}>
                          <i className="material-icons">price_check</i>
                        </button>
                      )}
                      {['pendiente', 'aprobado'].includes(p.estado) && (
                        <button
                          className="adm-icon-btn adm-icon-btn--danger"
                          title={p.estado === 'aprobado' ? 'Registrar reembolso / anular' : 'Anular'}
                          onClick={() => abrirAnular(p)}
                        >
                          <i className="material-icons">{p.estado === 'aprobado' ? 'undo' : 'block'}</i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalle && (
        <Modal title={`Pago ${detalle.referencia}`} onClose={() => setDetalle(null)}>
          <dl className="pagos-detalle">
            <div><dt>Concepto</dt><dd>{detalle.descripcion}</dd></div>
            <div><dt>Cliente</dt><dd>{cliente(detalle)} · {detalle.usuario_id?.email}</dd></div>
            <div><dt>Valor</dt><dd>{formatPrice(detalle.monto)} COP</dd></div>
            <div><dt>Método</dt><dd>{textoMetodo(detalle)} ({proveedores[detalle.proveedor]})</dd></div>
            <div><dt>Estado</dt><dd>{ESTADOS_PAGO[detalle.estado]?.label}{detalle.requiere_reembolso ? ' · hay que reembolsar' : ''}</dd></div>
            {detalle.mensaje && <div><dt>Nota</dt><dd>{detalle.mensaje}</dd></div>}
            {detalle.transaccion_id && <div><dt>Transacción</dt><dd><code>{detalle.transaccion_id}</code></dd></div>}
            <div><dt>Creado</dt><dd>{formatFechaHora(detalle.createdAt)}</dd></div>
            {detalle.pagado_en && <div><dt>Pagado</dt><dd>{formatFechaHora(detalle.pagado_en)}</dd></div>}
            {detalle.registrado_por && <div><dt>Registrado por</dt><dd>{detalle.registrado_por.nombre} {detalle.registrado_por.apellido}</dd></div>}
          </dl>
          <ErrorBanner message={accionError} />
          <div className="adm-form-actions">
            {detalle.estado === 'pendiente' && detalle.proveedor === 'manual' && (
              <button className="adm-btn" onClick={() => confirmar(detalle)} disabled={busy}>
                <i className="material-icons">price_check</i> Confirmar pago recibido
              </button>
            )}
            {['pendiente', 'aprobado'].includes(detalle.estado) && (
              <button className="adm-btn adm-btn--danger" onClick={() => abrirAnular(detalle)} disabled={busy}>
                {detalle.estado === 'aprobado' ? 'Registrar reembolso' : 'Anular'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {anular && (
        <Modal title={anular.estado === 'aprobado' ? 'Registrar reembolso' : 'Anular pago'} onClose={() => setAnular(null)}>
          <p className="adm-confirm-text">
            {anular.estado === 'aprobado'
              ? `El pago ${anular.referencia} (${formatPrice(anular.monto)}) quedará anulado y lo pagado volverá a "sin pagar". `
              : `El pago pendiente ${anular.referencia} quedará anulado. `}
            {anular.proveedor === 'wompi' && anular.estado === 'aprobado' && 'La devolución del dinero se hace desde el panel de Wompi.'}
          </p>
          <Field label="Motivo" full>
            <textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} />
          </Field>
          <ErrorBanner message={accionError} />
          <div className="adm-form-actions">
            <button className="adm-btn adm-btn--ghost" onClick={() => setAnular(null)} disabled={busy}>Volver</button>
            <button className="adm-btn adm-btn--danger" onClick={enviarAnulacion} disabled={busy || motivo.trim().length < 3}>
              {busy ? 'Procesando...' : 'Anular pago'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Pagos
