import { useState, useCallback } from 'react'
import { getUsuariosApi, updateUsuarioApi, getErrorMessage } from '../../../services/api'
import { formatDateLong } from '../../../utils/helpers'
import { useAuth } from '../../../hooks/useAuth'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import { PageHeader, ErrorBanner, Loading, EmptyState, StatusBadge, ConfirmDialog } from '../components/AdminUI'

const roles = [
  { value: 'usuario', label: 'Usuario' },
  { value: 'profesor', label: 'Profesor' },
  { value: 'admin', label: 'Admin' }
]

function Usuarios() {
  const { user: me } = useAuth()
  const { loadStats } = useAdmin()

  // La búsqueda se aplica en el servidor al pulsar Buscar
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const fetcher = useCallback(() => getUsuariosApi(appliedQuery), [appliedQuery])
  const { items: usuarios, setItems, loading, error, reload } = useAdminResource(fetcher)

  const [filtroRol, setFiltroRol] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [confirm, setConfirm] = useState(null) // { usuario, changes, title, message }
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const visible = filtroRol ? usuarios.filter(u => u.rol === filtroRol) : usuarios

  const applyUpdate = async (usuario, changes) => {
    const res = await updateUsuarioApi(usuario._id, changes)
    setItems(list => list.map(u => u._id === usuario._id ? res.data.usuario : u))
    loadStats()
  }

  const handleRolChange = (usuario, rol) => {
    if (rol === usuario.rol) return
    // Dar o quitar permisos de admin se confirma explícitamente
    if (rol === 'admin' || usuario.rol === 'admin') {
      setConfirmError('')
      setConfirm({
        usuario,
        changes: { rol },
        title: rol === 'admin' ? 'Dar permisos de administrador' : 'Quitar permisos de administrador',
        message: rol === 'admin'
          ? `${usuario.nombre} ${usuario.apellido} podrá gestionar canchas, productos, usuarios y todo el panel.`
          : `${usuario.nombre} ${usuario.apellido} perderá el acceso al panel de administración.`,
        danger: rol !== 'admin'
      })
      return
    }
    save(usuario, { rol })
  }

  const save = async (usuario, changes) => {
    setSavingId(usuario._id)
    setActionError('')
    try {
      await applyUpdate(usuario, changes)
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo actualizar el usuario'))
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleActivo = (usuario) => {
    setConfirmError('')
    setConfirm({
      usuario,
      changes: { activo: !usuario.activo },
      title: usuario.activo ? 'Desactivar cuenta' : 'Reactivar cuenta',
      message: usuario.activo
        ? `${usuario.nombre} ${usuario.apellido} no podrá iniciar sesión y su sesión actual dejará de funcionar.`
        : `${usuario.nombre} ${usuario.apellido} podrá volver a iniciar sesión.`,
      danger: usuario.activo
    })
  }

  const handleConfirm = async () => {
    setBusy(true)
    setConfirmError('')
    try {
      await applyUpdate(confirm.usuario, confirm.changes)
      setConfirm(null)
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo actualizar el usuario'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Roles y estado de las cuentas registradas" />

      <form
        className="adm-toolbar"
        onSubmit={e => { e.preventDefault(); setAppliedQuery(query.trim()) }}
      >
        <input
          type="search"
          placeholder="Buscar por nombre, apellido o email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="adm-btn adm-btn--ghost">
          <i className="material-icons">search</i> Buscar
        </button>
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
          <option value="">Todos los roles</option>
          {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </form>

      <ErrorBanner message={error} onRetry={reload} />
      <ErrorBanner message={actionError} />

      <div className="adm-card">
        {loading ? <Loading /> : visible.length === 0 ? (
          <EmptyState icon="group" text="No hay usuarios que coincidan." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Registro</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(u => {
                  const isMe = u._id === me?.id
                  return (
                    <tr key={u._id} className={u.activo ? '' : 'is-inactive'}>
                      <td>
                        <strong>{u.nombre} {u.apellido}</strong>
                        {isMe && <span className="adm-badge adm-badge--info" style={{ marginLeft: 8 }}>Tú</span>}
                      </td>
                      <td className="adm-muted">{u.email}</td>
                      <td className="adm-muted">{u.telefono || '—'}</td>
                      <td className="adm-muted">{formatDateLong(u.fecha_registro)}</td>
                      <td>
                        <div className="adm-field">
                          <select
                            value={u.rol}
                            onChange={e => handleRolChange(u, e.target.value)}
                            disabled={isMe || savingId === u._id}
                            title={isMe ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                          >
                            {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      </td>
                      <td><StatusBadge active={u.activo} activeText="Activa" inactiveText="Desactivada" /></td>
                      <td className="adm-actions">
                        <button
                          className={`adm-icon-btn ${u.activo ? 'adm-icon-btn--danger' : ''}`}
                          title={isMe ? 'No puedes desactivar tu propia cuenta' : u.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}
                          disabled={isMe}
                          onClick={() => handleToggleActivo(u)}
                        >
                          <i className="material-icons">{u.activo ? 'person_off' : 'person_add'}</i>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          busy={busy}
          error={confirmError}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default Usuarios
