import { useState, useCallback } from 'react'
import { getMediaApi, deleteMediaApi, mediaUrl, getErrorMessage } from '../../../services/api'
import { formatDateLong } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import { validateImageFile, uploadImage, ACCEPT_IMAGES } from '../imageUpload'
import { PageHeader, ErrorBanner, Loading, EmptyState, ConfirmDialog } from '../components/AdminUI'

const tipos = [
  { value: 'cancha', label: 'Canchas' },
  { value: 'producto', label: 'Productos' },
  { value: 'carrusel', label: 'Carrusel' },
  { value: 'clase', label: 'Clases' }
]

const formatSize = (bytes) => {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Media() {
  const { loadStats } = useAdmin()

  const [filtro, setFiltro] = useState('')
  const fetcher = useCallback(() => getMediaApi(filtro), [filtro])
  const { items: media, loading, error, reload } = useAdminResource(fetcher)

  const [tipoSubida, setTipoSubida] = useState('cancha')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState({ ok: '', error: '' })

  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return

    setUploading(true)
    setUploadMsg({ ok: '', error: '' })
    const errores = []
    let subidas = 0

    // Se suben de una en una para poder informar qué archivo falló
    for (const file of files) {
      const invalid = validateImageFile(file)
      if (invalid) {
        errores.push(`${file.name}: ${invalid}`)
        continue
      }
      try {
        await uploadImage(file, tipoSubida)
        subidas++
      } catch (err) {
        errores.push(`${file.name}: ${getErrorMessage(err, 'error al subir')}`)
      }
    }

    setUploading(false)
    setUploadMsg({
      ok: subidas ? `${subidas} imagen${subidas > 1 ? 'es subidas' : ' subida'} correctamente.` : '',
      error: errores.join(' · ')
    })
    if (subidas) {
      reload()
      loadStats()
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setConfirmError('')
    try {
      await deleteMediaApi(confirm._id)
      setConfirm(null)
      reload()
      loadStats()
    } catch (err) {
      // 409 si la imagen está en uso: el backend explica dónde
      setConfirmError(getErrorMessage(err, 'No se pudo eliminar la imagen'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Imágenes" subtitle="Galería de imágenes para canchas, productos y carrusel (JPG, PNG o WEBP, máximo 10MB)" />

      <div className="adm-toolbar">
        <select value={tipoSubida} onChange={e => setTipoSubida(e.target.value)} aria-label="Tipo de las imágenes a subir">
          {tipos.map(t => <option key={t.value} value={t.value}>Subir para: {t.label}</option>)}
        </select>
        <label className={`adm-btn ${uploading ? 'is-disabled' : ''}`}>
          <i className="material-icons">upload</i>
          {uploading ? 'Subiendo...' : 'Subir imágenes'}
          <input type="file" accept={ACCEPT_IMAGES} multiple onChange={handleFiles} disabled={uploading} hidden />
        </label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar por tipo" style={{ marginLeft: 'auto' }}>
          <option value="">Ver todas</option>
          {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {uploadMsg.ok && <div className="adm-alert adm-alert--ok">{uploadMsg.ok}</div>}
      <ErrorBanner message={uploadMsg.error} />
      <ErrorBanner message={error} onRetry={reload} />

      {loading ? <Loading /> : media.length === 0 ? (
        <div className="adm-card"><EmptyState icon="photo_library" text="No hay imágenes todavía." /></div>
      ) : (
        <div className="adm-gallery">
          {media.map(m => (
            <div className="adm-gallery-item" key={m._id}>
              <img src={mediaUrl(m.url)} alt={m.nombre_archivo} loading="lazy" />
              <span title={m.nombre_archivo}><strong>{m.nombre_archivo}</strong></span>
              <span className="adm-gallery-meta">
                {tipos.find(t => t.value === m.tipo)?.label} · {formatSize(m.tamano)} · {formatDateLong(m.uploaded_at)}
              </span>
              <button
                className="adm-icon-btn adm-icon-btn--danger adm-gallery-delete"
                title="Eliminar"
                onClick={() => { setConfirmError(''); setConfirm(m) }}
              >
                <i className="material-icons">delete</i>
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="Eliminar imagen"
          message={`¿Eliminar "${confirm.nombre_archivo}"? Esta acción no se puede deshacer. Si la imagen está en uso, primero quítala de la cancha, producto o slide.`}
          confirmText="Eliminar"
          busy={busy}
          error={confirmError}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default Media
