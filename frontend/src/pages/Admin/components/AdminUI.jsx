import { useEffect } from 'react'
import './AdminUI.css'

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="adm-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="adm-alert adm-alert--error" role="alert">
      <i className="material-icons">error_outline</i>
      <span>{message}</span>
      {onRetry && <button type="button" className="adm-btn adm-btn--small" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}

export function Loading({ text = 'Cargando...' }) {
  return (
    <div className="adm-empty">
      <i className="material-icons spinning">refresh</i>
      <p>{text}</p>
    </div>
  )
}

export function EmptyState({ icon = 'inbox', text }) {
  return (
    <div className="adm-empty">
      <i className="material-icons">{icon}</i>
      <p>{text}</p>
    </div>
  )
}

export function StatusBadge({ active, activeText = 'Activo', inactiveText = 'Inactivo', tone }) {
  const cls = tone || (active ? 'ok' : 'off')
  return <span className={`adm-badge adm-badge--${cls}`}>{active ? activeText : inactiveText}</span>
}

export function Modal({ title, onClose, children, wide = false }) {
  // Cierra con Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="adm-modal-overlay" onMouseDown={onClose}>
      <div
        className={`adm-modal ${wide ? 'adm-modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <h2>{title}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Cerrar">
            <i className="material-icons">close</i>
          </button>
        </div>
        <div className="adm-modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmText = 'Confirmar', danger = true, busy, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="adm-confirm-text">{message}</p>
      <ErrorBanner message={error} />
      <div className="adm-form-actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={busy}>
          Volver
        </button>
        <button
          type="button"
          className={`adm-btn ${danger ? 'adm-btn--danger' : ''}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Procesando...' : confirmText}
        </button>
      </div>
    </Modal>
  )
}

export function Field({ label, children, hint, full = false }) {
  return (
    <label className={`adm-field ${full ? 'adm-field--full' : ''}`}>
      <span className="adm-field-label">{label}</span>
      {children}
      {hint && <span className="adm-field-hint">{hint}</span>}
    </label>
  )
}
