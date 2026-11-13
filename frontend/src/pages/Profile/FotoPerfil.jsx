import { useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../services/api'
import Avatar from '../../components/Avatar/Avatar'
import { recortarFoto } from '../../components/Avatar/recortarFoto'

// Avatar del encabezado del perfil con botones para subir, cambiar o quitar la foto
function FotoPerfil() {
  const { user, subirFoto, quitarFoto } = useAuth()
  const inputRef = useRef(null)
  const [estado, setEstado] = useState('') // '' | 'subiendo' | 'quitando'
  const [error, setError] = useState('')

  const elegir = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    setError('')
    setEstado('subiendo')
    try {
      await subirFoto(await recortarFoto(archivo))
    } catch (err) {
      setError(err.response ? getErrorMessage(err, 'No se pudo subir la foto') : err.message)
    } finally {
      setEstado('')
    }
  }

  const quitar = async () => {
    setError('')
    setEstado('quitando')
    try {
      await quitarFoto()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo quitar la foto'))
    } finally {
      setEstado('')
    }
  }

  const ocupado = Boolean(estado)

  return (
    <div className="foto-perfil">
      <button
        type="button"
        className="foto-perfil-btn"
        onClick={() => inputRef.current?.click()}
        disabled={ocupado}
        title={user?.foto_url ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
        aria-label={user?.foto_url ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
      >
        <Avatar persona={user} size={80} className="foto-perfil-img" />
        <span className="foto-perfil-camara" aria-hidden="true">
          <i className={`material-icons ${estado === 'subiendo' ? 'spinning' : ''}`}>
            {estado === 'subiendo' ? 'refresh' : 'photo_camera'}
          </i>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={elegir}
        hidden
      />
      {user?.foto_url && (
        <button type="button" className="foto-perfil-quitar" onClick={quitar} disabled={ocupado}>
          {estado === 'quitando' ? 'Quitando...' : 'Quitar foto'}
        </button>
      )}
      {error && <p className="foto-perfil-error" role="alert">{error}</p>}
    </div>
  )
}

export default FotoPerfil
