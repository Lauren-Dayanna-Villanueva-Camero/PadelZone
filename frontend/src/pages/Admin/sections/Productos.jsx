import { useState } from 'react'
import {
  getProductosApi,
  createProductoApi,
  updateProductoApi,
  deleteProductoApi,
  getErrorMessage
} from '../../../services/api'
import { getProductImage, formatPrice } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import ImagePicker from '../components/ImagePicker'
import {
  PageHeader, ErrorBanner, Loading, EmptyState, StatusBadge, Modal, ConfirmDialog, Field
} from '../components/AdminUI'

const fetchProductos = () => getProductosApi(null, true)

const categorias = [
  { value: 'pala', label: 'Palas' },
  { value: 'ropa', label: 'Ropa' },
  { value: 'accesorios', label: 'Accesorios' },
  { value: 'calzado', label: 'Calzado' }
]
const categoriaLabel = Object.fromEntries(categorias.map(c => [c.value, c.label]))

const emptyForm = {
  nombre: '',
  descripcion: '',
  categoria: 'pala',
  precio: '',
  stock: '0',
  activo: true,
  imagen: null
}

const toForm = (p) => ({
  nombre: p.nombre,
  descripcion: p.descripcion || '',
  categoria: p.categoria,
  precio: String(p.precio),
  stock: String(p.stock),
  activo: p.activo,
  imagen: p.imagen_id || null
})

function Productos() {
  const { items: productos, loading, error, reload } = useAdminResource(fetchProductos)
  const { loadStats } = useAdmin()

  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const visible = productos.filter(p =>
    (!categoria || p.categoria === categoria) &&
    p.nombre.toLowerCase().includes(search.trim().toLowerCase())
  )

  const openNew = () => { setForm(emptyForm); setFormError(''); setEditing('new') }
  const openEdit = (p) => { setForm(toForm(p)); setFormError(''); setEditing(p) }
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [key]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const precio = Number(form.precio)
    const stock = Number(form.stock)
    if (form.nombre.trim().length < 2) return setFormError('El nombre debe tener al menos 2 caracteres')
    if (!Number.isFinite(precio) || precio < 0) return setFormError('El precio no es válido')
    if (!Number.isInteger(stock) || stock < 0) return setFormError('El stock debe ser un entero mayor o igual a 0')

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria,
      precio,
      stock,
      activo: form.activo,
      imagen_id: form.imagen?._id || null
    }

    setSaving(true)
    setFormError('')
    try {
      if (editing === 'new') await createProductoApi(payload)
      else await updateProductoApi(editing._id, payload)
      setEditing(null)
      reload()
      loadStats()
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el producto'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    const p = confirm
    setBusy(true)
    setConfirmError('')
    try {
      if (p.activo) await deleteProductoApi(p._id)
      else await updateProductoApi(p._id, { activo: true })
      setConfirm(null)
      reload()
      loadStats()
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo actualizar el producto'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo de la tienda: precios, stock e imágenes"
        action={
          <button className="adm-btn" onClick={openNew}>
            <i className="material-icons">add</i> Nuevo producto
          </button>
        }
      />

      <div className="adm-toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <ErrorBanner message={error} onRetry={reload} />

      <div className="adm-card">
        {loading ? <Loading /> : visible.length === 0 ? (
          <EmptyState icon="shopping_bag" text={productos.length ? 'Ningún producto coincide con el filtro.' : 'Aún no hay productos.'} />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p._id} className={p.activo ? '' : 'is-inactive'}>
                    <td><img className="adm-thumb" src={getProductImage(p)} alt="" /></td>
                    <td>
                      <strong>{p.nombre}</strong>
                      {p.descripcion && <div className="adm-muted">{p.descripcion.slice(0, 60)}{p.descripcion.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td>{categoriaLabel[p.categoria] || p.categoria}</td>
                    <td>{formatPrice(p.precio)}</td>
                    <td>
                      {p.stock <= 0
                        ? <span className="adm-badge adm-badge--danger">Agotado</span>
                        : p.stock <= 5
                          ? <span className="adm-badge adm-badge--warn">{p.stock}</span>
                          : p.stock}
                    </td>
                    <td><StatusBadge active={p.activo} /></td>
                    <td className="adm-actions">
                      <button className="adm-icon-btn" title="Editar" onClick={() => openEdit(p)}>
                        <i className="material-icons">edit</i>
                      </button>
                      <button
                        className={`adm-icon-btn ${p.activo ? 'adm-icon-btn--danger' : ''}`}
                        title={p.activo ? 'Desactivar' : 'Reactivar'}
                        onClick={() => { setConfirmError(''); setConfirm(p) }}
                      >
                        <i className="material-icons">{p.activo ? 'block' : 'restore'}</i>
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
        <Modal title={editing === 'new' ? 'Nuevo producto' : `Editar ${editing.nombre}`} onClose={() => setEditing(null)}>
          <form className="adm-form" onSubmit={handleSave}>
            <ErrorBanner message={formError} />
            <Field label="Nombre *" full>
              <input value={form.nombre} onChange={set('nombre')} required />
            </Field>
            <Field label="Descripción" full>
              <textarea value={form.descripcion} onChange={set('descripcion')} />
            </Field>
            <Field label="Categoría *">
              <select value={form.categoria} onChange={set('categoria')}>
                {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Precio (COP) *">
              <input type="number" min="0" step="100" value={form.precio} onChange={set('precio')} required />
            </Field>
            <Field label="Stock *">
              <input type="number" min="0" step="1" value={form.stock} onChange={set('stock')} required />
            </Field>
            <label className="adm-check">
              <input type="checkbox" checked={form.activo} onChange={set('activo')} /> Activo (visible en la tienda)
            </label>
            <Field label="Imagen" full>
              <ImagePicker tipo="producto" value={form.imagen} onChange={img => setForm(f => ({ ...f, imagen: img }))} />
            </Field>
            <div className="adm-form-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="adm-btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.activo ? 'Desactivar producto' : 'Reactivar producto'}
          message={confirm.activo
            ? `"${confirm.nombre}" dejará de mostrarse en la tienda. Los pedidos existentes no cambian.`
            : `"${confirm.nombre}" volverá a mostrarse en la tienda.`}
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

export default Productos
