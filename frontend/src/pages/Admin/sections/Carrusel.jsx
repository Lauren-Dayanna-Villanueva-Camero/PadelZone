import { useState } from 'react'
import {
  getCarruselApi,
  createSlideApi,
  updateSlideApi,
  deleteSlideApi,
  mediaUrl,
  getErrorMessage
} from '../../../services/api'
import { useAdminResource } from '../useAdminResource'
import ImagePicker from '../components/ImagePicker'
import {
  PageHeader, ErrorBanner, Loading, EmptyState, StatusBadge, Modal, ConfirmDialog, Field
} from '../components/AdminUI'

const fetchSlides = () => getCarruselApi(true)

const emptyForm = { titulo: '', subtitulo: '', orden: '0', activo: true, imagen: null }

const toForm = (s) => ({
  titulo: s.titulo,
  subtitulo: s.subtitulo || '',
  orden: String(s.orden ?? 0),
  activo: s.activo,
  imagen: s.imagen_id || null
})

function Carrusel() {
  const { items: slides, loading, error, reload } = useAdminResource(fetchSlides)

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const nextOrden = slides.length ? Math.max(...slides.map(s => s.orden ?? 0)) + 1 : 0

  const openNew = () => {
    setForm({ ...emptyForm, orden: String(nextOrden) })
    setFormError('')
    setEditing('new')
  }
  const openEdit = (s) => { setForm(toForm(s)); setFormError(''); setEditing(s) }
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [key]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const orden = Number(form.orden)
    if (!form.imagen) return setFormError('Selecciona una imagen para el slide')
    if (form.titulo.trim().length < 2) return setFormError('El título debe tener al menos 2 caracteres')
    if (!Number.isInteger(orden) || orden < 0) return setFormError('El orden debe ser un entero mayor o igual a 0')

    const payload = {
      titulo: form.titulo.trim(),
      subtitulo: form.subtitulo.trim(),
      orden,
      activo: form.activo,
      imagen_id: form.imagen._id
    }

    setSaving(true)
    setFormError('')
    try {
      if (editing === 'new') await createSlideApi(payload)
      else await updateSlideApi(editing._id, payload)
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el slide'))
    } finally {
      setSaving(false)
    }
  }

  // Intercambia el orden con el slide vecino
  const move = async (index, delta) => {
    const a = slides[index]
    const b = slides[index + delta]
    if (!b) return
    setActionError('')
    try {
      // Si comparten orden, se separan para que el intercambio tenga efecto
      const ordenA = a.orden === b.orden ? b.orden + delta : b.orden
      await Promise.all([
        updateSlideApi(a._id, { orden: Math.max(ordenA, 0) }),
        updateSlideApi(b._id, { orden: a.orden })
      ])
      reload()
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo cambiar el orden'))
    }
  }

  const handleToggle = async () => {
    const s = confirm
    setBusy(true)
    setConfirmError('')
    try {
      if (s.activo) await deleteSlideApi(s._id)
      else await updateSlideApi(s._id, { activo: true })
      setConfirm(null)
      reload()
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo actualizar el slide'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Carrusel"
        subtitle="Slides de la portada. El primer slide de la portada siempre es el video de bienvenida."
        action={
          <button className="adm-btn" onClick={openNew}>
            <i className="material-icons">add</i> Nuevo slide
          </button>
        }
      />

      <ErrorBanner message={error} onRetry={reload} />
      <ErrorBanner message={actionError} />

      <div className="adm-card">
        {loading ? <Loading /> : slides.length === 0 ? (
          <EmptyState icon="view_carousel" text="No hay slides. Mientras tanto la portada muestra los slides por defecto." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th></th>
                  <th>Título</th>
                  <th>Subtítulo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {slides.map((s, i) => (
                  <tr key={s._id} className={s.activo ? '' : 'is-inactive'}>
                    <td className="adm-actions" style={{ textAlign: 'left' }}>
                      <button className="adm-icon-btn" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                        <i className="material-icons">arrow_upward</i>
                      </button>
                      <button className="adm-icon-btn" title="Bajar" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                        <i className="material-icons">arrow_downward</i>
                      </button>
                    </td>
                    <td>
                      {s.imagen_id?.url
                        ? <img className="adm-thumb" src={mediaUrl(s.imagen_id.url)} alt="" />
                        : <span className="adm-badge adm-badge--danger">Sin imagen</span>}
                    </td>
                    <td><strong>{s.titulo}</strong></td>
                    <td className="adm-muted">{s.subtitulo || '—'}</td>
                    <td><StatusBadge active={s.activo} /></td>
                    <td className="adm-actions">
                      <button className="adm-icon-btn" title="Editar" onClick={() => openEdit(s)}>
                        <i className="material-icons">edit</i>
                      </button>
                      <button
                        className={`adm-icon-btn ${s.activo ? 'adm-icon-btn--danger' : ''}`}
                        title={s.activo ? 'Desactivar' : 'Reactivar'}
                        onClick={() => { setConfirmError(''); setConfirm(s) }}
                      >
                        <i className="material-icons">{s.activo ? 'block' : 'restore'}</i>
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
        <Modal title={editing === 'new' ? 'Nuevo slide' : 'Editar slide'} onClose={() => setEditing(null)}>
          <form className="adm-form" onSubmit={handleSave}>
            <ErrorBanner message={formError} />
            <Field label="Imagen *" full hint="Recomendado: imagen horizontal de al menos 1600px de ancho">
              <ImagePicker tipo="carrusel" value={form.imagen} onChange={img => setForm(f => ({ ...f, imagen: img }))} />
            </Field>
            <Field label="Título *" full>
              <input value={form.titulo} onChange={set('titulo')} required />
            </Field>
            <Field label="Subtítulo" full>
              <input value={form.subtitulo} onChange={set('subtitulo')} />
            </Field>
            <Field label="Orden" hint="Los números menores aparecen primero">
              <input type="number" min="0" step="1" value={form.orden} onChange={set('orden')} />
            </Field>
            <label className="adm-check">
              <input type="checkbox" checked={form.activo} onChange={set('activo')} /> Activo
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
          title={confirm.activo ? 'Desactivar slide' : 'Reactivar slide'}
          message={confirm.activo
            ? `"${confirm.titulo}" dejará de mostrarse en la portada.`
            : `"${confirm.titulo}" volverá a mostrarse en la portada.`}
          confirmText={confirm.activo ? 'Desactivar' : 'Reactivar'}
          danger={confirm.activo}
          busy={busy}
          error={confirmError}
          onConfirm={handleToggle}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default Carrusel
