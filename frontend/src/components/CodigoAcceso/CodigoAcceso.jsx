import { useState } from 'react'
import { getErrorMessage } from '../../services/api'
import './CodigoAcceso.css'

// Código de acceso de un torneo privado, con botones para copiarlo, copiar el
// enlace de invitación y generar uno nuevo. `onRegenerar` debe devolver el código nuevo.
function CodigoAcceso({ codigo, torneoId, onRegenerar }) {
  const [actual, setActual] = useState(codigo)
  const [copiado, setCopiado] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const enlace = `${window.location.origin}/torneos?torneo=${torneoId}&codigo=${actual}`

  const copiar = async (texto, que) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(que)
      setTimeout(() => setCopiado(''), 2000)
    } catch {
      setError('No se pudo copiar; selecciónalo y cópialo a mano.')
    }
  }

  const regenerar = async () => {
    setBusy(true)
    setError('')
    try {
      setActual(await onRegenerar())
      setConfirmar(false)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo generar un código nuevo'))
    } finally {
      setBusy(false)
    }
  }

  if (!actual) return null

  return (
    <div className="codigo-acceso">
      <div className="codigo-acceso-head">
        <i className="material-icons">vpn_key</i>
        <div>
          <span className="codigo-acceso-label">Código de acceso</span>
          <span className="codigo-acceso-ayuda">Solo quien lo tenga puede inscribirse. Compártelo con tu gente.</span>
        </div>
      </div>
      <div className="codigo-acceso-valor" aria-label={`Código ${actual}`}>{actual}</div>
      <div className="codigo-acceso-acciones">
        <button type="button" onClick={() => copiar(actual, 'codigo')}>
          <i className="material-icons">{copiado === 'codigo' ? 'check' : 'content_copy'}</i>
          {copiado === 'codigo' ? 'Copiado' : 'Copiar código'}
        </button>
        <button type="button" onClick={() => copiar(enlace, 'enlace')} title={enlace}>
          <i className="material-icons">{copiado === 'enlace' ? 'check' : 'link'}</i>
          {copiado === 'enlace' ? 'Copiado' : 'Copiar enlace de invitación'}
        </button>
        {onRegenerar && !confirmar && (
          <button type="button" className="secundario" onClick={() => setConfirmar(true)}>
            <i className="material-icons">autorenew</i>
            Generar otro
          </button>
        )}
      </div>
      {confirmar && (
        <div className="codigo-acceso-confirmar">
          <span>El código actual dejará de servir (quienes ya se inscribieron siguen inscritos).</span>
          <button type="button" onClick={regenerar} disabled={busy}>{busy ? 'Generando...' : 'Sí, generar'}</button>
          <button type="button" className="secundario" onClick={() => setConfirmar(false)} disabled={busy}>Cancelar</button>
        </div>
      )}
      {error && <p className="codigo-acceso-error" role="alert">{error}</p>}
    </div>
  )
}

export default CodigoAcceso
