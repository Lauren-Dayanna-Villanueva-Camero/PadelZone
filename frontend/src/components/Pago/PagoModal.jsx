import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { iniciarPagoApi, simularPagoApi, getErrorMessage } from '../../services/api'
import { formatPrice } from '../../utils/helpers'
import { cargarConfigPagos, textoMetodo, formatFechaHora, guardarRetornoPago } from './pagoUtils'
import './Pago.css'

const METODOS = [
  { id: 'tarjeta', label: 'Tarjeta', icon: 'credit_card', texto: 'Crédito o débito' },
  { id: 'pse', label: 'PSE', icon: 'account_balance', texto: 'Débito desde tu banco' },
  { id: 'nequi', label: 'Nequi', icon: 'smartphone', texto: 'Con tu celular' }
]

const formatTarjeta = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
const formatVence = (v) => v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')
const esperar = (ms) => new Promise(r => setTimeout(r, ms))

const vacio = { numero: '', titular: '', vence: '', cvv: '', banco: '', tipo_persona: 'natural', documento: '', telefono: '' }

/**
 * Modal de pago. Cobra lo indicado por `concepto` + `id`; el monto lo calcula el backend.
 * - efectivo: texto de la opción de pago en efectivo ('Pagar en la sede', 'Contraentrega'...) o null
 * - resumen: filas [etiqueta, valor] que se muestran arriba
 * - aviso: texto destacado (p. ej. el plazo para pagar una reserva)
 * - onTerminar(pago): pago aprobado o registrado en efectivo
 * - onCerrar(): se cerró sin terminar (lo pendiente se puede pagar luego desde el perfil)
 */
function PagoModal({ concepto, id, monto, titulo, resumen = [], efectivo = null, aviso = '', onTerminar, onCerrar }) {
  const location = useLocation()
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')
  const [paso, setPaso] = useState('metodo') // metodo | datos | procesando | resultado
  const [metodo, setMetodo] = useState('tarjeta')
  const [datos, setDatos] = useState(vacio)
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState('')
  const [pago, setPago] = useState(null)

  useEffect(() => {
    let cancelado = false
    cargarConfigPagos()
      .then(c => { if (!cancelado) setConfig(c) })
      .catch(err => { if (!cancelado) setConfigError(getErrorMessage(err, 'No se pudo cargar la configuración de pagos')) })
    return () => { cancelado = true }
  }, [])

  const ocupado = paso === 'procesando'
  const cerrar = () => {
    if (ocupado) return
    if (pago && (pago.estado === 'aprobado' || pago.metodo === 'efectivo')) onTerminar?.(pago)
    else onCerrar?.()
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const set = (campo, formato = (v) => v) => (e) => setDatos(d => ({ ...d, [campo]: formato(e.target.value) }))
  const wompi = config?.proveedor === 'wompi'

  const elegir = (m) => {
    setMetodo(m)
    setError('')
  }

  const pagarEfectivo = async () => {
    setError('')
    setPaso('procesando')
    setProcesando('Registrando tu pago...')
    try {
      const res = await iniciarPagoApi(concepto, id, 'efectivo')
      setPago(res.data.pago)
      setPaso('resultado')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo registrar el pago'))
      setPaso('metodo')
    }
  }

  const irAWompi = async () => {
    setError('')
    setPaso('procesando')
    setProcesando('Te llevamos a la pasarela segura de Wompi...')
    try {
      const res = await iniciarPagoApi(concepto, id, 'tarjeta')
      guardarRetornoPago({ volver: location.pathname + location.search, titulo, referencia: res.data.pago.referencia })
      window.location.assign(res.data.checkout_url)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo iniciar el pago'))
      setPaso('metodo')
    }
  }

  const continuar = () => {
    if (metodo === 'efectivo') return pagarEfectivo()
    if (wompi) return irAWompi()
    setError('')
    setPaso('datos')
  }

  const validar = () => {
    if (metodo === 'tarjeta') {
      if (datos.numero.replace(/\D/g, '').length < 13) return 'Escribe el número completo de la tarjeta'
      if (datos.titular.trim().length < 3) return 'Escribe el nombre del titular'
      if (!/^\d{2}\/\d{2}$/.test(datos.vence)) return 'Escribe la fecha de vencimiento (MM/AA)'
      if (!/^\d{3,4}$/.test(datos.cvv)) return 'Escribe el CVV'
    }
    if (metodo === 'pse') {
      if (!datos.banco) return 'Elige tu banco'
      if (!/^\d{5,15}$/.test(datos.documento)) return 'Escribe tu número de documento (solo números)'
    }
    if (metodo === 'nequi' && !/^3\d{9}$/.test(datos.telefono.replace(/\D/g, ''))) {
      return 'El celular de Nequi debe tener 10 dígitos y empezar por 3'
    }
    return ''
  }

  const pagarSimulado = async (e) => {
    e.preventDefault()
    const problema = validar()
    if (problema) {
      setError(problema)
      return
    }
    setError('')
    setPaso('procesando')
    try {
      setProcesando('Creando el pago...')
      const { data: { pago: nuevo } } = await iniciarPagoApi(concepto, id, metodo)
      // Pausas para que se entienda cada paso (en una pasarela real los pone el banco)
      if (metodo === 'pse') {
        setProcesando(`Conectando con ${datos.banco}...`)
        await esperar(1200)
      } else if (metodo === 'nequi') {
        setProcesando('Te enviamos una notificación a la app de Nequi. Acéptala para continuar...')
        await esperar(1800)
      } else {
        setProcesando('Validando la tarjeta con el banco...')
        await esperar(900)
      }
      const enviar = metodo === 'tarjeta'
        ? { metodo, numero: datos.numero.replace(/\D/g, ''), titular: datos.titular, vence: datos.vence, cvv: datos.cvv }
        : metodo === 'pse'
          ? { metodo, banco: datos.banco, tipo_persona: datos.tipo_persona, documento: datos.documento }
          : { metodo, telefono: datos.telefono.replace(/\D/g, '') }
      const res = await simularPagoApi(nuevo._id, enviar)
      setPago(res.data.pago)
      setDatos(d => ({ ...d, cvv: '' }))
      setPaso('resultado')
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo procesar el pago'))
      setPaso('datos')
    }
  }

  const reintentar = () => {
    setPago(null)
    setError('')
    setPaso('metodo')
  }

  return (
    <div className="pago-overlay" onMouseDown={cerrar}>
      <div className="pago-modal" role="dialog" aria-modal="true" aria-label={`Pago: ${titulo}`} onMouseDown={e => e.stopPropagation()}>
        <div className="pago-header">
          <div className="pago-header-title">
            <i className="material-icons">lock</i>
            <span>Pago seguro</span>
          </div>
          <button type="button" className="pago-close" onClick={cerrar} disabled={ocupado} aria-label="Cerrar">
            <i className="material-icons">close</i>
          </button>
        </div>

        <div className="pago-body">
          <div className="pago-resumen">
            <span className="pago-resumen-titulo">{titulo}</span>
            {resumen.map(([k, v]) => (
              <div className="pago-resumen-fila" key={k}><span>{k}</span><span>{v}</span></div>
            ))}
            <div className="pago-resumen-total">
              <span>Total a pagar</span>
              <span>{formatPrice(monto)} <small>COP</small></span>
            </div>
          </div>

          {aviso && paso !== 'resultado' && (
            <div className="pago-aviso">
              <i className="material-icons">timer</i>
              {aviso}
            </div>
          )}

          {error && (
            <div className="pago-error" role="alert">
              <i className="material-icons">error_outline</i>
              {error}
            </div>
          )}

          {paso === 'metodo' && (
            configError ? (
              <div className="pago-error"><i className="material-icons">error_outline</i>{configError}</div>
            ) : !config ? (
              <div className="pago-cargando"><i className="material-icons spinning">refresh</i></div>
            ) : (
              <>
                <h6 className="pago-subtitulo">¿Cómo quieres pagar?</h6>
                <div className="pago-metodos">
                  {wompi ? (
                    <button
                      type="button"
                      className={`pago-metodo ${metodo !== 'efectivo' ? 'activo' : ''}`}
                      onClick={() => elegir('tarjeta')}
                    >
                      <i className="material-icons">credit_card</i>
                      <span className="pago-metodo-label">Pagar en línea</span>
                      <span className="pago-metodo-texto">Tarjeta, PSE, Nequi o Bancolombia</span>
                    </button>
                  ) : METODOS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`pago-metodo ${metodo === m.id ? 'activo' : ''}`}
                      onClick={() => elegir(m.id)}
                    >
                      <i className="material-icons">{m.icon}</i>
                      <span className="pago-metodo-label">{m.label}</span>
                      <span className="pago-metodo-texto">{m.texto}</span>
                    </button>
                  ))}
                  {efectivo && (
                    <button
                      type="button"
                      className={`pago-metodo ${metodo === 'efectivo' ? 'activo' : ''}`}
                      onClick={() => elegir('efectivo')}
                    >
                      <i className="material-icons">payments</i>
                      <span className="pago-metodo-label">{efectivo}</span>
                      <span className="pago-metodo-texto">Efectivo o datáfono</span>
                    </button>
                  )}
                </div>

                <button type="button" className="pago-btn" onClick={continuar}>
                  {metodo === 'efectivo'
                    ? <><i className="material-icons">check</i> Confirmar</>
                    : wompi
                      ? <><i className="material-icons">open_in_new</i> Ir a pagar {formatPrice(monto)}</>
                      : <><i className="material-icons">arrow_forward</i> Continuar</>}
                </button>
                <button type="button" className="pago-btn-sec" onClick={cerrar}>Pagar más tarde</button>
                {wompi && (
                  <p className="pago-nota">
                    <i className="material-icons">verified_user</i>
                    Pagas en la página segura de Wompi (Bancolombia){config.sandbox ? ' · modo de pruebas' : ''}.
                  </p>
                )}
              </>
            )
          )}

          {paso === 'datos' && (
            <form className="pago-form" onSubmit={pagarSimulado} noValidate>
              <button type="button" className="pago-volver" onClick={() => { setError(''); setPaso('metodo') }}>
                <i className="material-icons">arrow_back</i> Cambiar método
              </button>

              {metodo === 'tarjeta' && (
                <>
                  <div className="pago-tarjeta-preview">
                    <i className="material-icons">contactless</i>
                    <div className="pago-tarjeta-numero">{datos.numero || '•••• •••• •••• ••••'}</div>
                    <div className="pago-tarjeta-pie">
                      <span>{datos.titular || 'NOMBRE APELLIDO'}</span>
                      <span>{datos.vence || 'MM/AA'}</span>
                    </div>
                  </div>
                  <label className="pago-campo">
                    <span>Número de la tarjeta</span>
                    <input inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242"
                      value={datos.numero} onChange={set('numero', formatTarjeta)} />
                  </label>
                  <label className="pago-campo">
                    <span>Nombre del titular</span>
                    <input autoComplete="cc-name" placeholder="Como aparece en la tarjeta"
                      value={datos.titular} onChange={set('titular', v => v.toUpperCase())} />
                  </label>
                  <div className="pago-fila">
                    <label className="pago-campo">
                      <span>Vence</span>
                      <input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" maxLength={5}
                        value={datos.vence} onChange={set('vence', formatVence)} />
                    </label>
                    <label className="pago-campo">
                      <span>CVV</span>
                      <input type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4}
                        value={datos.cvv} onChange={set('cvv', v => v.replace(/\D/g, ''))} />
                    </label>
                  </div>
                </>
              )}

              {metodo === 'pse' && (
                <>
                  <label className="pago-campo">
                    <span>Banco</span>
                    <select className="browser-default" value={datos.banco} onChange={set('banco')}>
                      <option value="">Elige tu banco</option>
                      {config.bancos_pse.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </label>
                  <div className="pago-fila">
                    <label className="pago-campo">
                      <span>Tipo de persona</span>
                      <select className="browser-default" value={datos.tipo_persona} onChange={set('tipo_persona')}>
                        <option value="natural">Natural</option>
                        <option value="juridica">Jurídica</option>
                      </select>
                    </label>
                    <label className="pago-campo">
                      <span>Documento</span>
                      <input inputMode="numeric" placeholder="1075123456"
                        value={datos.documento} onChange={set('documento', v => v.replace(/\D/g, '').slice(0, 15))} />
                    </label>
                  </div>
                </>
              )}

              {metodo === 'nequi' && (
                <label className="pago-campo">
                  <span>Celular registrado en Nequi</span>
                  <input inputMode="tel" placeholder="300 123 4567"
                    value={datos.telefono} onChange={set('telefono', v => v.replace(/[^\d ]/g, '').slice(0, 12))} />
                  <small>Te llegará una notificación para aceptar el pago.</small>
                </label>
              )}

              <button type="submit" className="pago-btn">
                <i className="material-icons">lock</i>
                Pagar {formatPrice(monto)}
              </button>

              <details className="pago-pruebas">
                <summary>Modo de pruebas: no se cobra dinero real</summary>
                <ul>
                  <li>Tarjeta <code>4242 4242 4242 4242</code> aprueba; <code>4111 1111 1111 1111</code> rechaza (cualquier fecha futura y CVV).</li>
                  <li>PSE: “Banco que rechaza” rechaza; los demás aprueban.</li>
                  <li>Nequi <code>3992222222</code> rechaza; los demás aprueban.</li>
                </ul>
              </details>
            </form>
          )}

          {paso === 'procesando' && (
            <div className="pago-procesando">
              <div className="pago-spinner" />
              <p>{procesando}</p>
              <span>No cierres esta ventana</span>
            </div>
          )}

          {paso === 'resultado' && pago && (
            <div className={`pago-resultado ${pago.estado}`}>
              <div className="pago-resultado-icono">
                <i className="material-icons">
                  {pago.estado === 'aprobado' ? 'check_circle' : pago.estado === 'pendiente' ? 'storefront' : 'cancel'}
                </i>
              </div>
              <h5>
                {pago.estado === 'aprobado' ? '¡Pago aprobado!'
                  : pago.estado === 'pendiente' ? 'Pago pendiente en la sede'
                    : 'Pago rechazado'}
              </h5>
              <p>
                {pago.estado === 'aprobado' ? 'Guardamos tu comprobante en tu perfil, en la pestaña Pagos.'
                  : pago.estado === 'pendiente' ? 'Muestra esta referencia al pagar. Te confirmaremos cuando lo recibamos.'
                    : pago.mensaje || 'El pago no se pudo completar. Puedes intentarlo con otro método.'}
              </p>
              <dl className="pago-comprobante">
                <div><dt>Referencia</dt><dd>{pago.referencia}</dd></div>
                <div><dt>Valor</dt><dd>{formatPrice(pago.monto)} COP</dd></div>
                <div><dt>Método</dt><dd>{textoMetodo(pago)}</dd></div>
                <div><dt>Fecha</dt><dd>{formatFechaHora(pago.pagado_en || pago.updatedAt || pago.createdAt)}</dd></div>
              </dl>
              {pago.estado === 'rechazado' ? (
                <>
                  <button type="button" className="pago-btn" onClick={reintentar}>
                    <i className="material-icons">refresh</i> Intentar de nuevo
                  </button>
                  <button type="button" className="pago-btn-sec" onClick={cerrar}>Pagar más tarde</button>
                </>
              ) : (
                <button type="button" className="pago-btn" onClick={cerrar}>Listo</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PagoModal
