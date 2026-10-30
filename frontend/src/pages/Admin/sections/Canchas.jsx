import { useState } from 'react'
import {
  getCanchasApi,
  createCanchaApi,
  updateCanchaApi,
  deleteCanchaApi,
  getErrorMessage
} from '../../../services/api'
import { getCourtImage, formatPrice } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import ImagePicker from '../components/ImagePicker'
import {
  PageHeader, ErrorBanner, Loading, EmptyState, StatusBadge, Modal, ConfirmDialog, Field
} from '../components/AdminUI'

const fetchCanchas = () => getCanchasApi(true)

const emptyForm = {
  nombre: '',
  tipo: 'Exterior',
  techada: false,
  precio_por_hora: '',
  caracteristicas: '',
  activa: true,
  imagen: null
}

const toForm = (c) => ({
  nombre: c.nombre,
  tipo: c.tipo,
  techada: !!c.techada,
  precio_por_hora: String(c.precio_por_hora),
  caracteristicas: (c.caracteristicas || []).join(', '),
  activa: c.activa,
  imagen: c.imagen_id || null
})

function Canchas() {
  const { items: canchas, loading, error, reload } = useAdminResource(fetchCanchas)
  const { loadStats } = useAdmin()

  const [editing, setEditing] = useState(null) // null | 'new' | cancha
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const openNew = () => { setForm(emptyForm); setFormError(''); setEditing('new') }
  const openEdit = (c) => { setForm(toForm(c)); setFormError(''); setEditing(c) }
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [key]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const precio = Number(form.precio_por_hora)
    if (form.nombre.trim().length < 2) return setFormError('El nombre debe tener al menos 2 caracteres')
    if (!Number.isFinite(precio) || precio < 0) return setFormError('El precio por hora no es válido')

    const payload = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      techada: form.techada,
      precio_por_hora: precio,
      caracteristicas: form.caracteristicas.split(',').map(s => s.trim()).filter(Boolean),
      activa: form.activa,
      imagen_id: form.imagen?._id || null
    }

    setSaving(true)
    setFormError('')
    try {
      if (editing === 'new') await createCanchaApi(payload)
      else await updateCanchaApi(editing._id, payload)
      setEditing(null)
      reload()
      loadStats()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la cancha'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    const c = confirm
    setBusy(true)
    setConfirmError('')
    try {
      // "Eliminar" en el backend es un borrado lógico (activa: false)
      if (c.activa) await deleteCanchaApi(c._id)
      else await updateCanchaApi(c._id, { activa: true })
      setConfirm(null)
      reload()
      loadStats()
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo actualizar la cancha'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Canchas"
        subtitle="Crea, edita y desactiva las canchas que se pueden reservar"
        action={
          <button className="adm-btn" onClick={openNew}>
            <i className="material-icons">add</i> Nueva cancha
          </button>
        }
      />

      <ErrorBanner message={error} onRetry={reload} />

      <div className="adm-card">
        {loading ? <Loading /> : canchas.length === 0 ? (
          <EmptyState icon="sports_tennis" text="Aún no hay canchas. Crea la primera." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Precio / hora</th>
                  <th>Características</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {canchas.map(c => (
                  <tr key={c._id} className={c.activa ? '' : 'is-inactive'}>
                    <td><img className="adm-thumb" src={getCourtImage(c)} alt="" /></td>
                    <td><strong>{c.nombre}</strong></td>
                    <td>{c.tipo}{c.techada ? ' · techada' : ''}</td>
                    <td>{formatPrice(c.precio_por_hora)}</td>
                    <td className="adm-muted">{(c.caracteristicas || []).join(', ') || '—'}</td>
                    <td><StatusBadge active={c.activa} activeText="Activa" inactiveText="Inactiva" /></td>
                    <td className="adm-actions">
                      <button className="adm-icon-btn" title="Editar" onClick={() => openEdit(c)}>
                        <i className="material-icons">edit</i>
                      </button>
                      <button
                        className={`adm-icon-btn ${c.activa ? 'adm-icon-btn--danger' : ''}`}
                        title={c.activa ? 'Desactivar' : 'Reactivar'}
                        onClick={() => { setConfirmError(''); setConfirm(c) }}
                      >
                        <i className="material-icons">{c.activa ? 'block' : 'restore'}</i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Nueva cancha' : `Editar ${editing.nombre}`} onClose={() => setEditing(null)}>
          <form className="adm-form" onSubmit={handleSave}>
            <ErrorBanner message={formError} />
            <Field label="Nombre *" full>
              <input value={form.nombre} onChange={set('nombre')} required />
            </Field>
            <Field label="Tipo *">
              <select value={form.tipo} onChange={set('tipo')}>
                <option value="Exterior">Exterior</option>
                <option value="Interior">Interior</option>
              </select>
            </Field>
            <Field label="Precio por hora (COP) *">
              <input type="number" min="0" step="1000" value={form.precio_por_hora} onChange={set('precio_por_hora')} required />
            </Field>
            <Field label="Características" hint="Separadas por comas: Iluminación LED, Vestuarios..." full>
              <input value={form.caracteristicas} onChange={set('caracteristicas')} />
            </Field>
            <Field label="Imagen" full>
              <ImagePicker tipo="cancha" value={form.imagen} onChange={img => setForm(f => ({ ...f, imagen: img }))} />
            </Field>
            <label className="adm-check">
              <input type="checkbox" checked={form.techada} onChange={set('techada')} /> Techada
            </label>
            <label className="adm-check">
              <input type="checkbox" checked={form.activa} onChange={set('activa')} /> Activa (visible para reservar)
            </label>
            <div className="adm-form-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="adm-btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.activa ? 'Desactivar cancha' : 'Reactivar cancha'}
          message={confirm.activa
            ? `"${confirm.nombre}" dejará de aparecer para reservar. Las reservas existentes se mantienen.`
            : `"${confirm.nombre}" volverá a estar disponible para reservar.`}
          confirmText={confirm.activa ? 'Desactivar' : 'Reactivar'}
          danger={confirm.activa}
          busy={busy}
          error={confirmError}
          onConfirm={handleToggle}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default Canchas
