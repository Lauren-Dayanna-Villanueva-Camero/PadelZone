import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verificarPagoWompiApi, getErrorMessage } from '../../services/api'
import { formatPrice } from '../../utils/helpers'
import { textoMetodo, formatFechaHora, leerRetornoPago } from '../../components/Pago/pagoUtils'
import '../../components/Pago/Pago.css'
import './PagoResultado.css'

// Página a la que vuelve Wompi (redirect-url) con ?id=<transacción>. El estado se
// consulta en el backend, que a su vez lo pregunta a Wompi: no se confía en la URL.
function PagoResultado() {
  const [params] = useSearchParams()
  const transaccion = params.get('id')
  const [pago, setPago] = useState(null)
  const [error, setError] = useState(transaccion ? '' : 'No recibimos el número de la transacción.')
  const [intentos, setIntentos] = useState(0)
  const retorno = leerRetornoPago()

  useEffect(() => {
    if (!transaccion) return
    let cancelado = false
    verificarPagoWompiApi(transaccion)
      .then(res => { if (!cancelado) setPago(res.data.pago) })
      .catch(err => { if (!cancelado) setError(getErrorMessage(err, 'No se pudo verificar el pago')) })
    return () => { cancelado = true }
  }, [transaccion, intentos])

  // PSE y Nequi pueden tardar unos segundos en confirmarse: se vuelve a consultar
  useEffect(() => {
    if (pago?.estado !== 'pendiente' || intentos >= 10) return
    const t = setTimeout(() => setIntentos(n => n + 1), 3000)
    return () => clearTimeout(t)
  }, [pago, intentos])

  const estado = pago?.estado
  const titulos = {
    aprobado: '¡Pago aprobado!',
    pendiente: 'Estamos confirmando tu pago',
    rechazado: 'Pago rechazado',
    anulado: 'Pago anulado'
  }

  return (
    <div className="pago-resultado-page">
      <div className="pago-resultado-card">
        {error ? (
          <div className="pago-resultado rechazado">
            <div className="pago-resultado-icono"><i className="material-icons">error_outline</i></div>
            <h5>No pudimos verificar el pago</h5>
            <p>{error}</p>
          </div>
        ) : !pago ? (
          <div className="pago-procesando">
            <div className="pago-spinner" />
            <p>Verificando tu pago con Wompi...</p>
          </div>
        ) : (
          <div className={`pago-resultado ${estado}`}>
            <div className="pago-resultado-icono">
              <i className="material-icons">
                {estado === 'aprobado' ? 'check_circle' : estado === 'pendiente' ? 'hourglass_top' : 'cancel'}
              </i>
            </div>
            <h5>{titulos[estado]}</h5>
            <p>
              {estado === 'aprobado' ? `${pago.descripcion}. Guardamos el comprobante en tu perfil.`
                : estado === 'pendiente' ? 'Tu banco aún no confirma la transacción. Esta página se actualiza sola.'
                  : pago.mensaje || 'La transacción no se completó. Puedes intentarlo de nuevo desde tu perfil.'}
            </p>
            <dl className="pago-comprobante">
              <div><dt>Referencia</dt><dd>{pago.referencia}</dd></div>
              <div><dt>Concepto</dt><dd>{pago.descripcion}</dd></div>
              <div><dt>Valor</dt><dd>{formatPrice(pago.monto)} COP</dd></div>
              <div><dt>Método</dt><dd>{textoMetodo(pago)}</dd></div>
              <div><dt>Fecha</dt><dd>{formatFechaHora(pago.pagado_en || pago.updatedAt)}</dd></div>
            </dl>
          </div>
        )}

        <div className="pago-resultado-acciones">
          {retorno?.volver && <Link className="pago-btn" to={retorno.volver}>Volver</Link>}
          <Link className="pago-btn-sec" to="/perfil?tab=pagos">Ver mis pagos</Link>
        </div>
      </div>
    </div>
  )
}

export default PagoResultado
