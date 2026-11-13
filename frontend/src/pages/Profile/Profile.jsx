import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getReservasApi,
  cancelarReservaApi,
  getMisInscripcionesApi,
  getPedidosApi,
  getMisPagosApi,
  getMisMultasApi,
  getErrorMessage
} from '../../services/api'
import {
  getCourtImage,
  getTournamentImage,
  formatPrice,
  formatDateLong,
  toDateKey,
  todayKey
} from '../../utils/helpers'
import PagoModal from '../../components/Pago/PagoModal'
import Calendario from '../../components/Calendario/Calendario'
import FotoPerfil from './FotoPerfil'
import { CONCEPTOS, ESTADOS_PAGO, textoMetodo, formatFechaHora } from '../../components/Pago/pagoUtils'
import './Profile.css'

const TABS = ['reservations', 'tournaments', 'orders', 'pagos', 'calendario', 'data']

const torneoEstados = {
  activo: 'Inscripciones abiertas',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado'
}

const pedidoEstados = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  enviado: 'Enviado',
  cancelado: 'Cancelado'
}

// Un torneo activo cuya fecha ya pasó se muestra como finalizado aunque el
// backend aún no lo haya actualizado
const estadoTorneo = (t) =>
  t.estado !== 'cancelado' && toDateKey(t.fecha_fin) < todayKey() ? 'finalizado' : t.estado

// Para un admin GET /reservas y GET /pedidos devuelven los de todos los usuarios;
// en el perfil solo se muestran los propios
const esMio = (doc, userId) => {
  const owner = doc.usuario_id?._id ?? doc.usuario_id
  return !owner || String(owner) === String(userId)
}

// Carga una lista al montar (y cada vez que cambia `version`) con su estado de carga y error
function useLista(fetcher, errorText, userId, version = 0) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (isCancelled = () => false) => {
    try {
      const res = await fetcher()
      if (!isCancelled()) {
        // Sin userId el endpoint ya devuelve solo lo del usuario (p. ej. /pagos/mios)
        setItems(userId ? res.data.filter(d => esMio(d, userId)) : res.data)
        setError('')
      }
    } catch (err) {
      if (!isCancelled()) setError(getErrorMessage(err, errorText))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [fetcher, errorText, userId])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    load(() => cancelled)
    return () => { cancelled = true }
  }, [load, version])

  return { items, setItems, loading, error }
}

function ListState({ loading, error, loadingText }) {
  if (loading) {
    return (
      <div className="profile-empty">
        <i className="material-icons spinning">refresh</i>
        <p>{loadingText}</p>
      </div>
    )
  }
  return (
    <div className="profile-empty">
      <i className="material-icons">error_outline</i>
      <h5>{error}</h5>
    </div>
  )
}

function Profile() {
  const { user, logout, updateProfile } = useAuth()
  const navigate = useNavigate()

  const userId = user?.id
  // Sube después de pagar algo para volver a cargar las listas
  const [recargas, setRecargas] = useState(0)
  const {
    items: reservations,
    setItems: setReservations,
    loading: loadingRes,
    error: resError
  } = useLista(getReservasApi, 'No se pudieron cargar tus reservas', userId, recargas)
  // mis-inscripciones ya filtra por el usuario de la sesión
  const torneos = useLista(getMisInscripcionesApi, 'No se pudieron cargar tus torneos', null, recargas)
  const pedidos = useLista(getPedidosApi, 'No se pudieron cargar tus pedidos', userId, recargas)
  const pagos = useLista(getMisPagosApi, 'No se pudieron cargar tus pagos', null, recargas)
  // Multas por no asistir a reservas que se iban a pagar en la sede
  const [multas, setMultas] = useState(null)
  useEffect(() => {
    let cancelado = false
    getMisMultasApi()
      .then(res => { if (!cancelado) setMultas(res.data) })
      .catch(() => { /* sin multas no se muestra nada */ })
    return () => { cancelado = true }
  }, [recargas])

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: '', apellido: '', telefono: '' })
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  // Pestaña en la URL (/perfil?tab=pagos) para poder enlazarla
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'reservations'
  const setActiveTab = (tab) => setSearchParams(tab === 'reservations' ? {} : { tab }, { replace: true })
  // Lo que se va a pagar en el PagoModal
  const [cobro, setCobro] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelError, setCancelError] = useState('')

  const handleCancelReservation = async (id) => {
    setCancelError('')
    try {
      await cancelarReservaApi(id)
      setReservations(prev => prev.map(r => r._id === id ? { ...r, estado: 'cancelada' } : r))
      setCancelTarget(null)
    } catch (err) {
      setCancelError(getErrorMessage(err, 'No se pudo cancelar la reserva'))
    }
  }

  const startEdit = () => {
    setEditForm({
      nombre: user?.nombre || '',
      apellido: user?.apellido || '',
      telefono: user?.telefono || ''
    })
    setEditError('')
    setEditMode(true)
  }

  const handleEditSave = async () => {
    setSaving(true)
    setEditError('')
    try {
      await updateProfile({
        nombre: editForm.nombre.trim(),
        apellido: editForm.apellido.trim(),
        telefono: editForm.telefono.trim()
      })
      setEditMode(false)
    } catch (err) {
      setEditError(getErrorMessage(err, 'No se pudieron guardar los cambios'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const fullName = [user?.nombre, user?.apellido].filter(Boolean).join(' ')

  const today = todayKey()
  const active = reservations.filter(r => r.estado !== 'cancelada')
  const upcoming = active.filter(r => toDateKey(r.fecha) >= today)
  const past = reservations.filter(r => !upcoming.includes(r))
  const totalSpent = pagos.items.filter(p => p.estado === 'aprobado').reduce((acc, p) => acc + p.monto, 0)

  // Si el torneo fue borrado, torneo_id llega en null
  const misTorneos = torneos.items.filter(r => r.torneo_id)
  const torneosVigentes = misTorneos.filter(r => ['activo', 'en_curso'].includes(estadoTorneo(r.torneo_id)))
  const pedidosAbiertos = pedidos.items.filter(p => p.estado === 'pendiente' || p.estado === 'pagado')

  // ─── Pagos ───
  // Pagos en efectivo registrados (se pagan en la sede; no hace falta volver a pagar)
  const enEfectivo = new Set(pagos.items
    .filter(p => p.estado === 'pendiente' && p.proveedor === 'manual')
    .map(p => `${p.concepto}:${p.referencia_id}`))

  const cobroReserva = (r) => ({
    concepto: 'reserva', id: r._id, monto: r.precio, efectivo: multas?.solo_en_linea ? null : 'Pagar en la sede',
    titulo: `Reserva ${r.cancha_id?.nombre ?? ''}`,
    resumen: [['Fecha', formatDateLong(r.fecha)], ['Horario', `${r.hora_inicio} – ${r.hora_fin}`]]
  })
  const cobroPedido = (p) => ({
    concepto: 'pedido', id: p._id, monto: p.precio_total, efectivo: 'Contraentrega',
    titulo: `Pedido #${p._id.slice(-6).toUpperCase()}`,
    resumen: [['Entrega', `${p.direccion_envio ?? ''}, ${p.ciudad ?? ''}`]]
  })
  const cobroTorneo = (reg) => ({
    concepto: 'torneo', id: reg._id, monto: reg.torneo_id.precio_inscripcion, efectivo: 'Pagar en la sede',
    titulo: `Inscripción · ${reg.torneo_id.nombre}`,
    resumen: [['Fecha del torneo', formatDateLong(reg.torneo_id.fecha_inicio)]]
  })

  const cobroMulta = (m) => ({
    concepto: 'multa', id: m._id, monto: m.monto, efectivo: 'Pagar en la sede',
    titulo: 'Multa por inasistencia',
    resumen: [['Detalle', m.descripcion.replace(/^Multa por no asistir · /, '')]]
  })
  const multasPendientes = (multas?.multas ?? []).filter(m => m.estado === 'pendiente')

  const reservaPorPagar = (r) => r.estado !== 'cancelada' && !r.pagada && !r.no_asistio && toDateKey(r.fecha) >= today
  const torneoPorPagar = (reg) => !reg.pago_confirmado && !reg.inscrito_por_pareja &&
    reg.torneo_id.precio_inscripcion > 0 && ['activo', 'en_curso'].includes(estadoTorneo(reg.torneo_id))
  const porPagar = [
    ...multasPendientes.map(m => ({ key: `m${m._id}`, icon: 'gavel', texto: m.descripcion, cobro: cobroMulta(m), multa: true })),
    ...reservations.filter(reservaPorPagar).map(r => ({ key: `r${r._id}`, icon: 'event_available', texto: `Reserva ${r.cancha_id?.nombre ?? ''} · ${toDateKey(r.fecha)} · ${r.hora_inicio}`, cobro: cobroReserva(r), apartada: r.estado === 'pendiente' ? r.expira_en : null })),
    ...pedidos.items.filter(p => p.estado === 'pendiente').map(p => ({ key: `p${p._id}`, icon: 'shopping_bag', texto: `Pedido #${p._id.slice(-6).toUpperCase()}`, cobro: cobroPedido(p) })),
    ...misTorneos.filter(torneoPorPagar).map(reg => ({ key: `t${reg._id}`, icon: 'emoji_events', texto: `Inscripción · ${reg.torneo_id.nombre}`, cobro: cobroTorneo(reg) }))
  ].map(item => ({ ...item, efectivo: enEfectivo.has(`${item.cobro.concepto}:${item.cobro.id}`) }))

  const terminarCobro = () => {
    setCobro(null)
    setRecargas(n => n + 1)
  }

  return (
    <div className="profile-page">

      {/* Header */}
      <div className="profile-header">
        <div className="container">
          <div className="profile-header-content">
            <FotoPerfil />
            <div className="profile-header-info">
              <h1>{fullName || 'Usuario'}</h1>
              <p>{user?.email}</p>
              <span className="profile-badge">
                <i className="material-icons">verified</i>
                {user?.rol === 'admin' ? 'Administrador' : 'Miembro PadelZone'}
              </span>
            </div>
            <button className="profile-logout-btn" onClick={handleLogout}>
              <i className="material-icons">logout</i>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <div className="container profile-body">

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat-card">
            <i className="material-icons">event_available</i>
            <div>
              <span className="stat-number">{active.length}</span>
              <span className="stat-label">Reservas totales</span>
            </div>
          </div>
          <div className="profile-stat-card">
            <i className="material-icons">upcoming</i>
            <div>
              <span className="stat-number">{upcoming.length}</span>
              <span className="stat-label">Próximas</span>
            </div>
          </div>
          <div className="profile-stat-card">
            <i className="material-icons">payments</i>
            <div>
              <span className="stat-number">{formatPrice(totalSpent)}</span>
              <span className="stat-label">Total pagado</span>
            </div>
          </div>
        </div>

        {multasPendientes.length > 0 && (
          <div className="profile-multa-aviso" role="alert">
            <i className="material-icons">gavel</i>
            <div>
              <strong>
                Tienes {multasPendientes.length === 1 ? 'una multa pendiente' : `${multasPendientes.length} multas pendientes`} de {formatPrice(multas.total_pendiente)}
              </strong>
              <span>
                No llegaste a una reserva que ibas a pagar en la sede y la cancha quedó apartada sin usarse.
                Mientras no la pagues no puedes hacer reservas nuevas.
              </span>
            </div>
            <button
              className="pagos-pagar-btn"
              onClick={() => multasPendientes.length === 1 ? setCobro(cobroMulta(multasPendientes[0])) : setActiveTab('pagos')}
            >
              <i className="material-icons">payment</i>
              Pagar multa
            </button>
          </div>
        )}
        {multas?.solo_en_linea && multasPendientes.length === 0 && (
          <div className="profile-multa-aviso profile-multa-aviso--info">
            <i className="material-icons">info</i>
            <div>
              <span>
                Por tus inasistencias recientes ({multas.inasistencias} en los últimos {multas.reglas.dias_historial} días),
                tus reservas solo se pueden pagar en línea por ahora.
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            <i className="material-icons">event</i>
            Mis Reservaciones
            {upcoming.length > 0 && (
              <span className="tab-badge">{upcoming.length}</span>
            )}
          </button>
          <button
            className={`profile-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
            onClick={() => setActiveTab('tournaments')}
          >
            <i className="material-icons">emoji_events</i>
            Mis Torneos
            {torneosVigentes.length > 0 && (
              <span className="tab-badge">{torneosVigentes.length}</span>
            )}
          </button>
          <button
            className={`profile-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <i className="material-icons">shopping_bag</i>
            Mis Pedidos
            {pedidosAbiertos.length > 0 && (
              <span className="tab-badge">{pedidosAbiertos.length}</span>
            )}
          </button>
          <button
            className={`profile-tab ${activeTab === 'pagos' ? 'active' : ''}`}
            onClick={() => setActiveTab('pagos')}
          >
            <i className="material-icons">payments</i>
            Pagos
            {porPagar.filter(p => !p.efectivo).length > 0 && (
              <span className="tab-badge tab-badge--warn">{porPagar.filter(p => !p.efectivo).length}</span>
            )}
          </button>
          <button
            className={`profile-tab ${activeTab === 'calendario' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendario')}
          >
            <i className="material-icons">calendar_month</i>
            Calendario
          </button>
          <button
            className={`profile-tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <i className="material-icons">person</i>
            Mis Datos
          </button>
        </div>

        {/* Tab: Reservaciones */}
        {activeTab === 'reservations' && (
          <div className="profile-reservations">

            {loadingRes || resError ? (
              <ListState loading={loadingRes} error={resError} loadingText="Cargando reservas..." />
            ) : reservations.length === 0 ? (
              <div className="profile-empty">
                <i className="material-icons">event_busy</i>
                <h5>No tienes reservaciones aún</h5>
                <p>Reserva una cancha y aparecerá aquí</p>
                <button className="profile-empty-btn" onClick={() => navigate('/reservar')}>
                  Reservar Ahora
                </button>
              </div>
            ) : (
              <>
                {/* Próximas */}
                {upcoming.length > 0 && (
                  <>
                    <h6 className="res-group-title">
                      <i className="material-icons">upcoming</i>
                      Próximas Reservaciones
                    </h6>
                    <div className="res-cards-grid">
                      {upcoming.map(res => (
                        <ReservationCard
                          key={res._id}
                          res={res}
                          upcoming={true}
                          onCancel={() => { setCancelError(''); setCancelTarget(res._id) }}
                          onPagar={reservaPorPagar(res) ? () => setCobro(cobroReserva(res)) : null}
                          enSede={enEfectivo.has(`reserva:${res._id}`)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Pasadas y canceladas */}
                {past.length > 0 && (
                  <>
                    <h6 className="res-group-title past">
                      <i className="material-icons">history</i>
                      Historial
                    </h6>
                    <div className="res-cards-grid">
                      {past.map(res => (
                        <ReservationCard
                          key={res._id}
                          res={res}
                          upcoming={false}
                          onCancel={null}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Torneos */}
        {activeTab === 'tournaments' && (
          <div className="profile-reservations">
            {torneos.loading || torneos.error ? (
              <ListState loading={torneos.loading} error={torneos.error} loadingText="Cargando torneos..." />
            ) : misTorneos.length === 0 ? (
              <div className="profile-empty">
                <i className="material-icons">emoji_events</i>
                <h5>No estás inscrito en ningún torneo</h5>
                <p>Inscríbete en un torneo y aparecerá aquí</p>
                <button className="profile-empty-btn" onClick={() => navigate('/torneos')}>
                  Ver Torneos
                </button>
              </div>
            ) : (
              <div className="res-cards-grid">
                {misTorneos.map(reg => (
                  <TournamentCard
                    key={reg._id}
                    reg={reg}
                    onPagar={torneoPorPagar(reg) ? () => setCobro(cobroTorneo(reg)) : null}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Pedidos */}
        {activeTab === 'orders' && (
          <div className="profile-reservations">
            {pedidos.loading || pedidos.error ? (
              <ListState loading={pedidos.loading} error={pedidos.error} loadingText="Cargando pedidos..." />
            ) : pedidos.items.length === 0 ? (
              <div className="profile-empty">
                <i className="material-icons">shopping_bag</i>
                <h5>No tienes pedidos aún</h5>
                <p>Tus compras en la tienda aparecerán aquí</p>
                <button className="profile-empty-btn" onClick={() => navigate('/tiendas')}>
                  Ir a la Tienda
                </button>
              </div>
            ) : (
              <div className="order-list">
                {pedidos.items.map(p => (
                  <OrderCard
                    key={p._id}
                    pedido={p}
                    onPagar={p.estado === 'pendiente' ? () => setCobro(cobroPedido(p)) : null}
                    contraentrega={enEfectivo.has(`pedido:${p._id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Pagos */}
        {activeTab === 'pagos' && (
          <div className="profile-reservations">
            {porPagar.length > 0 && (
              <>
                <h6 className="res-group-title">
                  <i className="material-icons">pending_actions</i>
                  Por pagar
                </h6>
                <ul className="pagos-por-pagar">
                  {porPagar.map(item => (
                    <li key={item.key}>
                      <i className="material-icons">{item.icon}</i>
                      <div>
                        <span className="pagos-por-pagar-texto">{item.texto}</span>
                        <span className="pagos-por-pagar-sub">
                          {item.efectivo
                            ? 'Elegiste pagar en efectivo · también puedes pagar en línea'
                            : item.multa
                              ? 'Mientras no la pagues no puedes hacer reservas nuevas'
                              : item.apartada
                              ? `Apartada hasta las ${new Date(item.apartada).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
                              : 'Pago pendiente'}
                        </span>
                      </div>
                      <strong>{formatPrice(item.cobro.monto)}</strong>
                      <button className="pagos-pagar-btn" onClick={() => setCobro(item.cobro)}>
                        <i className="material-icons">payment</i>
                        Pagar
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h6 className="res-group-title past">
              <i className="material-icons">receipt_long</i>
              Historial de pagos
            </h6>
            {pagos.loading || pagos.error ? (
              <ListState loading={pagos.loading} error={pagos.error} loadingText="Cargando pagos..." />
            ) : pagos.items.length === 0 ? (
              <div className="profile-empty">
                <i className="material-icons">receipt_long</i>
                <h5>Aún no tienes pagos</h5>
                <p>Los comprobantes de tus reservas, compras, torneos y clases aparecerán aquí</p>
              </div>
            ) : (
              <div className="pagos-historial">
                {pagos.items.map(p => <PagoRow key={p._id} pago={p} />)}
              </div>
            )}
          </div>
        )}

        {/* Tab: Calendario */}
        {activeTab === 'calendario' && <Calendario />}

        {/* Tab: Datos */}
        {activeTab === 'data' && (
          <div className="profile-data-card">
            <div className="profile-data-header">
              <h5>Información Personal</h5>
              {!editMode && (
                <button className="profile-edit-btn" onClick={startEdit}>
                  <i className="material-icons">edit</i>
                  Editar
                </button>
              )}
            </div>

            {editMode ? (
              <div className="profile-edit-form">
                {editError && <p className="profile-edit-error" role="alert">{editError}</p>}
                <div className="profile-edit-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={editForm.nombre}
                    onChange={e => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>
                <div className="profile-edit-field">
                  <label>Apellido</label>
                  <input
                    type="text"
                    value={editForm.apellido}
                    onChange={e => setEditForm(prev => ({ ...prev, apellido: e.target.value }))}
                  />
                </div>
                <div className="profile-edit-field">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    value={editForm.telefono}
                    onChange={e => setEditForm(prev => ({ ...prev, telefono: e.target.value }))}
                  />
                </div>
                <div className="profile-edit-actions">
                  <button className="profile-save-btn" onClick={handleEditSave} disabled={saving}>
                    <i className="material-icons">check</i>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button className="profile-cancel-edit-btn" onClick={() => setEditMode(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-data-rows">
                <div className="profile-data-row">
                  <div className="profile-data-icon">
                    <i className="material-icons">person</i>
                  </div>
                  <div>
                    <p className="profile-data-label">Nombre</p>
                    <p className="profile-data-value">{fullName || '—'}</p>
                  </div>
                </div>
                <div className="profile-data-row">
                  <div className="profile-data-icon">
                    <i className="material-icons">email</i>
                  </div>
                  <div>
                    <p className="profile-data-label">Email</p>
                    <p className="profile-data-value">{user?.email || '—'}</p>
                  </div>
                </div>
                <div className="profile-data-row">
                  <div className="profile-data-icon">
                    <i className="material-icons">phone</i>
                  </div>
                  <div>
                    <p className="profile-data-label">Teléfono</p>
                    <p className="profile-data-value">{user?.telefono || '—'}</p>
                  </div>
                </div>
                <div className="profile-data-row">
                  <div className="profile-data-icon">
                    <i className="material-icons">key</i>
                  </div>
                  <div>
                    <p className="profile-data-label">Inicio de sesión</p>
                    <p className="profile-data-value">
                      {user?.google && user?.tiene_password
                        ? 'Con Google o con tu email y contraseña'
                        : user?.google
                          ? 'Con Google'
                          : 'Con tu email y contraseña'}
                    </p>
                    {user?.google && !user?.tiene_password && (
                      <p className="profile-data-label">
                        Si quieres entrar también con contraseña, créala desde "¿Olvidaste tu contraseña?" en la página de inicio de sesión.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {cobro && (
        <PagoModal
          {...cobro}
          onTerminar={terminarCobro}
          onCerrar={terminarCobro}
        />
      )}

      {/* Modal cancelar */}
      {cancelTarget && (
        <div className="profile-modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-modal-icon">
              <i className="material-icons">warning</i>
            </div>
            <h5>¿Cancelar reservación?</h5>
            <p>Esta acción no se puede deshacer.</p>
            {cancelError && <p className="profile-edit-error" role="alert">{cancelError}</p>}
            <div className="profile-modal-actions">
              <button
                className="profile-modal-confirm"
                onClick={() => handleCancelReservation(cancelTarget)}
              >
                Sí, cancelar
              </button>
              <button
                className="profile-modal-dismiss"
                onClick={() => setCancelTarget(null)}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function ReservationCard({ res, upcoming, onCancel, onPagar, enSede }) {
  const cancha = res.cancha_id
  const cancelled = res.estado === 'cancelada'
  const status = cancelled ? 'Cancelada' : res.no_asistio ? 'No asististe' : res.estado === 'pendiente' ? 'Por pagar' : upcoming ? 'Próxima' : 'Completada'
  const multa = res.multa_id

  return (
    <div className={`res-card ${upcoming ? 'upcoming' : 'past'}`}>
      <div className="res-card-img">
        <img src={getCourtImage(cancha)} alt={cancha?.nombre || 'Cancha'} />
        <span className={`res-card-status ${upcoming ? 'upcoming' : 'past'}`}>
          {status}
        </span>
      </div>
      <div className="res-card-body">
        <div className="res-card-title-row">
          <h6>{cancha?.nombre || 'Cancha eliminada'}</h6>
          <span className="res-card-price">{formatPrice(res.precio)}</span>
        </div>
        <div className="res-card-details">
          <p>
            <i className="material-icons">calendar_today</i>
            {toDateKey(res.fecha)}
          </p>
          <p>
            <i className="material-icons">schedule</i>
            {res.hora_inicio} – {res.hora_fin}
          </p>
          {cancha?.tipo && (
            <p>
              <i className="material-icons">sports_tennis</i>
              {cancha.tipo}
            </p>
          )}
          {res.no_asistio && (
            <p>
              <i className="material-icons">gavel</i>
              <span className={`pago-chip ${multa?.estado === 'pagada' ? 'pagado' : multa?.estado === 'anulada' ? 'neutro' : 'pendiente'}`}>
                {multa?.estado === 'pagada'
                  ? `Multa pagada (${formatPrice(multa.monto)})`
                  : multa?.estado === 'anulada'
                    ? 'Multa anulada'
                    : `Multa pendiente${multa ? ` · ${formatPrice(multa.monto)}` : ''}`}
              </span>
            </p>
          )}
          {!cancelled && !res.no_asistio && (
            <p>
              <i className="material-icons">payments</i>
              {res.pagada
                ? <span className="pago-chip pagado"><i className="material-icons">check_circle</i>Pagada</span>
                : res.estado === 'pendiente'
                  ? <span className="pago-chip pendiente"><i className="material-icons">timer</i>Paga antes de las {new Date(res.expira_en).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}</span>
                  : <span className="pago-chip pendiente"><i className="material-icons">storefront</i>{enSede ? 'Pagas en la sede' : 'Sin pagar'}</span>}
            </p>
          )}
        </div>
        {onPagar && (
          <button className="res-card-pay-btn" onClick={onPagar}>
            <i className="material-icons">payment</i>
            Pagar {formatPrice(res.precio)}
          </button>
        )}
        {upcoming && onCancel && (
          <button className="res-card-cancel-btn" onClick={onCancel}>
            <i className="material-icons">cancel</i>
            Cancelar Reserva
          </button>
        )}
      </div>
    </div>
  )
}

function TournamentCard({ reg, onPagar }) {
  const t = reg.torneo_id
  const estado = estadoTorneo(t)
  const vigente = estado === 'activo' || estado === 'en_curso'

  let equipo
  if (estado === 'cancelado') {
    equipo = 'Torneo cancelado'
  } else if (estado === 'activo') {
    equipo = 'Las parejas se publicarán al cerrar las inscripciones'
  } else if (reg.equipo == null) {
    equipo = 'Sin pareja asignada'
  } else {
    const c = reg.companero
    equipo = `Equipo #${reg.equipo} — con ${c ? `${c.nombre} ${c.apellido}` : 'tu pareja'}`
  }

  return (
    <div className={`res-card ${vigente ? 'upcoming' : 'past'}`}>
      <div className="res-card-img">
        <img src={getTournamentImage(t)} alt={t.nombre} />
        <span className={`res-card-status torneo-${estado}`}>{torneoEstados[estado]}</span>
      </div>
      <div className="res-card-body">
        <div className="res-card-title-row">
          <h6>{t.nombre}</h6>
          <span className="res-card-price">{formatPrice(t.precio_inscripcion)}</span>
        </div>
        <div className="res-card-details">
          <p>
            <i className="material-icons">calendar_today</i>
            {formatDateLong(t.fecha_inicio)} – {formatDateLong(t.fecha_fin)}
          </p>
          <p>
            <i className="material-icons">groups</i>
            {equipo}
          </p>
          <p>
            <i className="material-icons">payments</i>
            {reg.inscrito_por_pareja
              ? `Te inscribió ${reg.pareja_usuario_id?.nombre ?? 'tu pareja'}`
              : reg.pago_confirmado ? 'Pago confirmado' : 'Pago pendiente'}
          </p>
        </div>
        {onPagar && (
          <button className="res-card-pay-btn" onClick={onPagar}>
            <i className="material-icons">payment</i>
            Pagar inscripción
          </button>
        )}
      </div>
    </div>
  )
}

function OrderCard({ pedido, onPagar, contraentrega }) {
  return (
    <div className={`order-card ${pedido.estado === 'cancelado' ? 'cancelled' : ''}`}>
      <div className="order-card-head">
        <div>
          <h6>Pedido del {formatDateLong(pedido.fecha_pedido)}</h6>
          <span className="order-card-id">#{pedido._id.slice(-6).toUpperCase()}</span>
        </div>
        <span className={`order-status ${pedido.estado}`}>{pedidoEstados[pedido.estado] || pedido.estado}</span>
      </div>

      <ul className="order-items">
        {pedido.items.map(item => (
          <li key={item._id}>
            <span>{item.nombre} <span className="order-qty">× {item.cantidad}</span></span>
            <span>{formatPrice(item.precio_unitario * item.cantidad)}</span>
          </li>
        ))}
      </ul>

      <div className="order-totals">
        <div><span>Subtotal</span><span>{formatPrice(pedido.subtotal)}</span></div>
        <div><span>Envío</span><span>{pedido.precio_envio ? formatPrice(pedido.precio_envio) : 'Gratis'}</span></div>
        <div className="total"><span>Total</span><span>{formatPrice(pedido.precio_total)}</span></div>
      </div>

      {pedido.numero_guia && (
        <p className="order-tracking">
          <i className="material-icons">local_shipping</i>
          {pedido.operador_logistico ? `${pedido.operador_logistico} · ` : ''}Guía {pedido.numero_guia}
        </p>
      )}

      {onPagar && (
        <div className="order-pay">
          <span>{contraentrega ? 'Pagas contraentrega (o en línea ahora)' : 'Este pedido aún no está pagado'}</span>
          <button className="pagos-pagar-btn" onClick={onPagar}>
            <i className="material-icons">payment</i>
            Pagar {formatPrice(pedido.precio_total)}
          </button>
        </div>
      )}
    </div>
  )
}

// Una fila del historial de pagos; al tocarla se ve el comprobante
function PagoRow({ pago }) {
  const [abierto, setAbierto] = useState(false)
  const estado = ESTADOS_PAGO[pago.estado]
  return (
    <div className={`pago-row ${abierto ? 'abierto' : ''}`}>
      <button className="pago-row-head" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}>
        <i className="material-icons pago-row-icono">{CONCEPTOS[pago.concepto]?.icon}</i>
        <div className="pago-row-texto">
          <span>{pago.descripcion}</span>
          <small>{formatFechaHora(pago.createdAt)} · {textoMetodo(pago)}</small>
        </div>
        <strong>{formatPrice(pago.monto)}</strong>
        <span className={`pago-chip ${pago.estado}`}>
          <i className="material-icons">{estado?.icon}</i>{estado?.label}
        </span>
        <i className="material-icons pago-row-flecha">expand_more</i>
      </button>
      {abierto && (
        <dl className="pago-row-detalle">
          <div><dt>Referencia</dt><dd>{pago.referencia}</dd></div>
          <div><dt>Método</dt><dd>{textoMetodo(pago)}</dd></div>
          {pago.pagado_en && <div><dt>Pagado</dt><dd>{formatFechaHora(pago.pagado_en)}</dd></div>}
          {pago.mensaje && <div><dt>Nota</dt><dd>{pago.mensaje}</dd></div>}
          {pago.estado === 'pendiente' && pago.proveedor === 'manual' && (
            <div><dt>Cómo pagar</dt><dd>Muestra esta referencia en la recepción de PadelZone (o al recibir tu pedido).</dd></div>
          )}
        </dl>
      )}
    </div>
  )
}

export default Profile
