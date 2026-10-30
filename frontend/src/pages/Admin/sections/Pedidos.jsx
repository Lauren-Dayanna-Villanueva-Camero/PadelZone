import { useState } from 'react'
import { getPedidosApi, updateEstadoPedidoApi, cancelarPedidoApi, getErrorMessage } from '../../../services/api'
import { formatPrice, formatDateLong } from '../../../utils/helpers'
import { useAdmin } from '../../../hooks/useAdmin'
import { useAdminResource } from '../useAdminResource'
import { PageHeader, ErrorBanner, Loading, EmptyState, Modal, ConfirmDialog } from '../components/AdminUI'

const estados = [
  { value: 'pendiente', label: 'Pendiente', tone: 'warn' },
  { value: 'pagado', label: 'Pagado', tone: 'info' },
  { value: 'enviado', label: 'Enviado', tone: 'ok' },
  { value: 'cancelado', label: 'Cancelado', tone: 'off' }
]
const estadoInfo = Object.fromEntries(estados.map(e => [e.value, e]))

function Pedidos() {
  const { items: pedidos, setItems, loading, error, reload } = useAdminResource(getPedidosApi)
  const { loadStats } = useAdmin()

  const [filtro, setFiltro] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [actionError, setActionError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [confirm, setConfirm] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)

  const visible = filtro ? pedidos.filter(p => p.estado === filtro) : pedidos

  const handleEstado = async (pedido, estado) => {
    if (estado === pedido.estado) return
    // Cancelar devuelve el stock: se usa el endpoint específico y se confirma
    if (estado === 'cancelado') {
      setConfirmError('')
      setConfirm(pedido)
      return
    }
    setSavingId(pedido._id)
    setActionError('')
    try {
      await updateEstadoPedidoApi(pedido._id, estado)
      setItems(list => list.map(p => p._id === pedido._id ? { ...p, estado } : p))
      loadStats()
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo cambiar el estado'))
    } finally {
      setSavingId(null)
    }
  }

  const handleCancel = async () => {
    setBusy(true)
    setConfirmError('')
    try {
      await cancelarPedidoApi(confirm._id)
      setConfirm(null)
      reload()
      loadStats()
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'No se pudo cancelar el pedido'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Pedidos" subtitle="Pedidos de la tienda y su estado de envío" />

      <div className="adm-toolbar">
        <select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <ErrorBanner message={error} onRetry={reload} />
      <ErrorBanner message={actionError} />

      <div className="adm-card">
        {loading ? <Loading /> : visible.length === 0 ? (
          <EmptyState icon="receipt_long" text="No hay pedidos." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Envío a</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  // Un pedido cancelado o enviado ya no se puede cancelar desde el backend
                  const cerrado = p.estado === 'cancelado'
                  return (
                    <tr key={p._id} className={cerrado ? 'is-inactive' : ''}>
                      <td className="adm-muted">{formatDateLong(p.fecha_pedido)}</td>
                      <td>
                        {p.usuario_id ? `${p.usuario_id.nombre} ${p.usuario_id.apellido}` : 'Usuario eliminado'}
                        <div className="adm-muted">{p.usuario_id?.email}</div>
                      </td>
                      <td className="adm-muted">{p.ciudad} · {p.direccion_envio}</td>
                      <td>{p.items?.reduce((s, i) => s + i.cantidad, 0) || 0}</td>
                      <td><strong>{formatPrice(p.precio_total)}</strong></td>
                      <td>
                        {cerrado ? (
                          <span className="adm-badge adm-badge--off">Cancelado</span>
                        ) : (
                          <div className="adm-field">
                            <select
                              value={p.estado}
                              disabled={savingId === p._id}
                              onChange={e => handleEstado(p, e.target.value)}
                            >
                              {estados
                                .filter(e => !(e.value === 'cancelado' && p.estado === 'enviado'))
                                .map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="adm-actions">
                        <button className="adm-icon-btn" title="Ver detalle" onClick={() => setDetalle(p)}>
                          <i className="material-icons">visibility</i>
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

      {detalle && (
        <Modal title="Detalle del pedido" onClose={() => setDetalle(null)} wide>
          <p className="adm-muted">
            {formatDateLong(detalle.fecha_pedido)} ·{' '}
            <span className={`adm-badge adm-badge--${estadoInfo[detalle.estado]?.tone}`}>{estadoInfo[detalle.estado]?.label}</span>
          </p>
          <p>
            <strong>Cliente:</strong> {detalle.usuario_id?.nombre} {detalle.usuario_id?.apellido} ({detalle.usuario_id?.email})<br />
            <strong>Envío:</strong> {detalle.direccion_envio}, {detalle.ciudad} · Tel. {detalle.telefono_envio}
          </p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Producto</th><th>Precio unitario</th><th>Cantidad</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {detalle.items?.map(i => (
                  <tr key={i._id}>
                    <td>{i.nombre}</td>
                    <td>{formatPrice(i.precio_unitario)}</td>
                    <td>{i.cantidad}</td>
                    <td>{formatPrice(i.precio_unitario * i.cantidad)}</td>
                  </tr>
                ))}
                <tr><td colSpan={3}>Envío</td><td>{formatPrice(detalle.precio_envio)}</td></tr>
                <tr><td colSpan={3}><strong>Total</strong></td><td><strong>{formatPrice(detalle.precio_total)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title="Cancelar pedido"
          message="El pedido pasará a cancelado y el stock de sus productos se devolverá al inventario."
          confirmText="Cancelar pedido"
          busy={busy}
          error={confirmError}
          onConfirm={handleCancel}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default Pedidos
