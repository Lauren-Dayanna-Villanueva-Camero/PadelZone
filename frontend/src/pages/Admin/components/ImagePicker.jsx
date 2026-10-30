import { useState } from 'react'
import { getMediaApi, mediaUrl, getErrorMessage } from '../../../services/api'
import { validateImageFile, uploadImage, ACCEPT_IMAGES as ACCEPT } from '../imageUpload'
import { Modal, Loading, EmptyState, ErrorBanner } from './AdminUI'

// Selector de imagen para formularios: muestra la actual, permite elegir de la galería o subir una nueva.
// `value` es el objeto imagen ({ _id, url }) o null; `onChange` recibe el objeto o null.
function ImagePicker({ tipo, value, onChange }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [gallery, setGallery] = useState([])
  const [loadingGallery, setLoadingGallery] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const openGallery = async () => {
    setGalleryOpen(true)
    setLoadingGallery(true)
    setError('')
    try {
      const res = await getMediaApi(tipo)
      setGallery(res.data)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar la galería'))
    } finally {
      setLoadingGallery(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const invalid = validateImageFile(file)
    if (invalid) {
      setError(invalid)
      return
    }

    setUploading(true)
    setError('')
    try {
      const media = await uploadImage(file, tipo)
      onChange(media)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo subir la imagen'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="adm-image-picker">
      <div className="adm-image-preview">
        {value?.url
          ? <img src={mediaUrl(value.url)} alt="Imagen seleccionada" />
          : <i className="material-icons">image</i>}
      </div>

      <div className="adm-image-actions">
        <label className={`adm-btn adm-btn--small ${uploading ? 'is-disabled' : ''}`}>
          <i className="material-icons">upload</i>
          {uploading ? 'Subiendo...' : 'Subir nueva'}
          <input type="file" accept={ACCEPT} onChange={handleFile} disabled={uploading} hidden />
        </label>
        <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={openGallery}>
          <i className="material-icons">photo_library</i>
          Galería
        </button>
        {value && (
          <button type="button" className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => onChange(null)}>
            Quitar
          </button>
        )}
      </div>

      {!galleryOpen && <ErrorBanner message={error} />}

      {galleryOpen && (
        <Modal title="Elegir imagen" onClose={() => setGalleryOpen(false)} wide>
          <ErrorBanner message={error} />
          {loadingGallery ? (
            <Loading />
          ) : gallery.length === 0 ? (
            <EmptyState icon="photo_library" text={`No hay imágenes de tipo "${tipo}". Sube una nueva.`} />
          ) : (
            <div className="adm-gallery">
              {gallery.map(m => (
                <button
                  type="button"
                  key={m._id}
                  className={`adm-gallery-item ${value?._id === m._id ? 'is-selected' : ''}`}
                  onClick={() => { onChange(m); setGalleryOpen(false) }}
                >
                  <img src={mediaUrl(m.url)} alt={m.nombre_archivo} loading="lazy" />
                  <span>{m.nombre_archivo}</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default ImagePicker
