import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Tienda.css'
import { getProductosApi, createPedidoApi, getErrorMessage } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { getProductImage } from '../../utils/helpers'

// Deben coincidir con el cálculo del backend (pedidos.controller.js), que es el que manda
const SHIPPING = 15000
const FREE_SHIPPING_THRESHOLD = 300000

// El carrito vive en el navegador; el backend solo recibe el pedido final
const CART_KEY = 'padelzone_cart'

const loadCart = () => {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

const saveCart = (items) => {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)) } catch { /* sin acceso a storage */ }
}

// Adapta el producto del backend al formato de la vista
const toViewProduct = (p) => ({
  id: p._id,
  name: p.nombre,
  desc: p.descripcion,
  price: p.precio,
  stock: p.stock,
  img: getProductImage(p),
  badge: p.stock <= 0 ? 'Agotado' : p.stock <= 5 ? 'Últimas unidades' : null,
  badgeColor: p.stock <= 0 ? '#757575' : '#e53935'
})

function tiendaKey(key, extra = '') {
  return `tienda-${key}${extra}`
}

/* ═══════════════════════
   DEFAULT EXPORT
   ═══════════════════════ */

export default function Tienda() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [products, setProducts] = useState([])
  const [cartItems, setCartItems] = useState(loadCart) // { id, name, price, img, qty, stock }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [purchaseDone, setPurchaseDone] = useState(false)

  /* ── Cargar productos al montar ── */
  useEffect(() => {
    let cancelled = false
    getProductosApi()
      .then((res) => {
        if (cancelled) return
        const list = res.data.map(toViewProduct)
        setProducts(list)
        // Sincroniza el carrito guardado con precios/stock actuales y quita productos que ya no existen
        setCartItems((prev) => prev.flatMap((item) => {
          const p = list.find((x) => x.id === item.id)
          if (!p || p.stock <= 0) return []
          return [{ ...item, name: p.name, price: p.price, img: p.img, stock: p.stock, qty: Math.min(item.qty, p.stock) }]
        }))
      })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err, 'No se pudieron cargar los productos')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  /* ── Persistir carrito ── */
  useEffect(() => {
    saveCart(cartItems)
  }, [cartItems])

  /* ── Agregar al carrito ── */
  const addToCart = useCallback((product) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, qty: Math.min(i.qty + 1, product.stock) } : i)
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, img: product.img, stock: product.stock, qty: 1 }]
    })
    setToast({ productName: product.name })
    setCartOpen(true)
    setTimeout(() => setToast(null), 2800)
  }, [])

  /* ── Eliminar del carrito ── */
  const removeFromCart = useCallback((id) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  /* ── Modificar cantidad (entre 1 y el stock disponible) ── */
  const changeQty = useCallback((id, delta) => {
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== id) return i
      const qty = Math.max(1, Math.min(i.qty + delta, i.stock ?? Infinity))
      return { ...i, qty }
    }))
  }, [])

  /* ── Vaciar carrito ── */
  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  /* ── Totales ── */
  const subtotal = cartItems.reduce((s, item) => s + item.price * item.qty, 0)
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : cartItems.length ? SHIPPING : 0
  const total = subtotal + shippingCost

  /* ── Checkout ── */
  const handleCheckout = useCallback(() => {
    setCartOpen(false)
    // Crear un pedido requiere sesión
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } })
      return
    }
    setCheckoutOpen(true)
  }, [isAuthenticated, navigate, location])

  // Si falla, lanza el error para que el modal lo muestre
  const handlePay = useCallback(async (shipping) => {
    await createPedidoApi({
      items: cartItems.map((i) => ({ producto_id: i.id, cantidad: i.qty })),
      ciudad: shipping.ciudad,
      direccion_envio: shipping.direccion,
      telefono_envio: shipping.telefono
    })
    setCheckoutOpen(false)
    setCartItems([])
    setPurchaseDone(true)
    setTimeout(() => setPurchaseDone(false), 3500)

    // Refresca el stock mostrado
    getProductosApi().then((res) => setProducts(res.data.map(toViewProduct))).catch(() => {})
  }, [cartItems])

  /* ═══════════════════════
     RENDER
     ═══════════════════════ */

  if (loading) {
    return (
      <section className="tienda-page">
        <div className="tienda-loading">
          <i className="material-icons spinning">refresh</i>
          <p>Cargando productos…</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="tienda-page">
        <div className="tienda-error">
          <i className="material-icons">error_outline</i>
          <p>Error: {error}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="tienda-page">
      {toast && <Toast message={toast.productName} />}

      {/* ── Header ── */}
      <div className="tienda-header">
        <div className="tienda-header-content">
          <span className="tienda-eyebrow">PadelZone Store</span>
          <h1>Nuestros Productos</h1>
          <p>Equipamiento oficial para jugar al más alto nivel</p>
        </div>
        <button
          className="cart-badge"
          onClick={() => setCartOpen((v) => !v)}
          aria-label="Abrir carrito"
        >
          <i className="material-icons">shopping_cart</i>
          <span className="cart-count">{cartItems.reduce((s, i) => s + i.qty, 0)}</span>
        </button>
        <div className="tienda-header-bg" />
      </div>

      {/* ── Products grid ── */}
      <div className="tienda-container">
        {products.length === 0 && (
          <p className="tienda-empty">No hay productos disponibles por ahora.</p>
        )}
        <div className="tienda-products-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              formatPrice={formatPrice}
              onAddToCart={() => addToCart(product)}
            />
          ))}
        </div>
      </div>

      {/* ── Cart drawer ── */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        formatPrice={formatPrice}
        subtotal={subtotal}
        shippingCost={shippingCost}
        total={total}
        onRemove={removeFromCart}
        onChangeQty={changeQty}
        onClear={clearCart}
        onCheckout={handleCheckout}
      />

      {/* ── Checkout modal ── */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cartItems}
        formatPrice={formatPrice}
        subtotal={subtotal}
        shippingCost={shippingCost}
        total={total}
        defaultPhone={user?.telefono}
        onConfirmPay={handlePay}
      />

      {/* ── Purchase success ── */}
      {purchaseDone && <PurchaseSuccess />}
    </section>
  )
}

/* ═══════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════ */

function formatPrice(price) {
  return '$' + price.toLocaleString('es-CO')
}

/* ═══════════════════════════════════════
   COMPONENTES INTERNOS
   ═══════════════════════════════════════ */

function ProductCard({ product, formatPrice, onAddToCart }) {
  const isOutOfStock = product.stock <= 0

  return (
    <div className={`product-card ${isOutOfStock ? 'product-card--disabled' : ''}`}>
      {product.badge && (
        <span className="product-badge" style={{ backgroundColor: product.badgeColor }}>
          {product.badge}
        </span>
      )}

      <div className="product-image-wrapper">
        <img className="product-image" src={product.img} alt={product.name} />
        <div className="product-image-overlay" />
      </div>

      <div className="product-body">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">{product.desc}</p>
        <div className="product-footer">
          <span className="product-price">{formatPrice(product.price)} COP</span>
          {isOutOfStock ? (
            <button className="product-btn product-btn--disabled" disabled>
              Agotado
            </button>
          ) : (
            <button className="product-btn" onClick={onAddToCart}>
              Agregar al carrito
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Toast({ message }) {
  return (
    <div className="tienda-toast">
      <i className="material-icons">check_circle</i>
      <span>"{message}" agregado al carrito</span>
    </div>
  )
}

/* ── Cart drawer ────────────────────────── */

function CartDrawer({
  open,
  onClose,
  items,
  formatPrice,
  subtotal,
  shippingCost,
  total,
  onRemove,
  onChangeQty,
  onClear,
  onCheckout,
}) {
  return (
    <>
      <div
        className={`cart-overlay ${open ? 'cart-overlay--visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`cart-drawer ${open ? 'cart-drawer--open' : ''}`}>
        <div className="cart-header">
          <h2>
            <i className="material-icons">shopping_bag</i>
            Carrito
          </h2>
          <button className="cart-close-btn" onClick={onClose} aria-label="Cerrar carrito">
            <i className="material-icons">close</i>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <i className="material-icons">shopping_cart_off</i>
            <p>Tu carrito está vacío</p>
            <button className="product-btn" onClick={onClose}>Seguir comprando</button>
          </div>
        ) : (
          <>
            <ul className="cart-items">
              {items.map((item) => (
                <li className="cart-item" key={tiendaKey(item.id, 'cart')}>
                  <div className="cart-item-image">
                    <img src={item.img} alt={item.name} />
                  </div>
                  <div className="cart-item-right">
                    <div className="cart-item-top-row">
                      <h4>{item.name}</h4>
                      <div className="cart-item-actions">
                        <button
                          className="qty-btn qty-minus"
                          onClick={() => onChangeQty(item.id, -1)}
                          disabled={item.qty <= 1}
                          aria-label="Reducir cantidad"
                        >
                          <i className="material-icons">remove</i>
                        </button>
                        <span className="qty-value">{item.qty}</span>
                        <button
                          className="qty-btn qty-plus"
                          onClick={() => onChangeQty(item.id, 1)}
                          disabled={item.qty >= item.stock}
                          aria-label="Aumentar cantidad"
                        >
                          <i className="material-icons">add</i>
                        </button>
                      </div>
                    </div>
                    <div className="cart-item-bottom-row">
                      <span className="cart-item-price">{formatPrice(item.price)} COP</span>
                      <button
                        className="cart-item-remove"
                        onClick={() => onRemove(item.id)}
                        aria-label="Eliminar producto"
                      >
                        <i className="material-icons">delete_outline</i>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Shipping progress bar */}
            {shippingCost > 0 && subtotal > 0 && (
              <div className="cart-shipping-progress">
                <div className="sp-label">
                  <i className="material-icons">local_shipping</i>
                  <span>Faltan <strong>{formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} COP</strong> para envío gratis</span>
                </div>
                <div className="sp-track">
                  <div
                    className="sp-fill"
                    style={{ width: `${Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {shippingCost === 0 && subtotal > 0 && (
              <div className="cart-shipping-progress cart-shipping-progress--done">
                <div className="sp-label">
                  <i className="material-icons">check_circle</i>
                  <span>¡Envío <strong>gratis</strong> aplicado!</span>
                </div>
                <div className="sp-track">
                  <div className="sp-fill sp-fill--full" />
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="cart-totals">
              <div className="cart-total-row">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)} COP</span>
              </div>
              <div className="cart-total-row">
                <span>Envío</span>
                <span>{shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost) + ' COP'}</span>
              </div>
              <div className="cart-total-row cart-total-final">
                <span>Total</span>
                <span>{formatPrice(total)} COP</span>
              </div>
            </div>

            <button className="cart-checkout-btn" onClick={onCheckout}>
              Proceder al pago
            </button>
            <button className="cart-clear-btn" onClick={onClear}>
              Vaciar carrito
            </button>
          </>
        )}
      </aside>
    </>
  )
}

/* ── Checkout modal ──────────────────────── */

function CheckoutModal({ open, onClose, items, formatPrice, subtotal, shippingCost, total, defaultPhone, onConfirmPay }) {
  const emptyForm = { telefono: defaultPhone || '', ciudad: '', direccion: '', method: 'card' }
  const [step, setStep] = useState('summary')
  const [form, setForm] = useState(emptyForm)
  const [payError, setPayError] = useState('')

  if (!open) return null

  const handleNext = () => step === 'summary' && setStep('form')
  const handlePrev = () => setStep('summary')

  // El método de pago es solo visual: no hay pasarela de pago integrada
  const handleSubmit = async (e) => {
    e.preventDefault()
    setPayError('')
    setStep('processing')
    try {
      await onConfirmPay({
        telefono: form.telefono.trim(),
        ciudad: form.ciudad.trim(),
        direccion: form.direccion.trim()
      })
      setStep('summary')
      setForm(emptyForm)
    } catch (err) {
      setPayError(getErrorMessage(err, 'No se pudo crear el pedido.'))
      setStep('form')
    }
  }

  return (
    <div className="checkout-overlay" onClick={onClose}>
      <section className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <button className="checkout-close-btn" onClick={onClose} aria-label="Cerrar">
          <i className="material-icons">close</i>
        </button>

        {/* STEP 1 — Resumen */}
        {step === 'summary' && (
          <>
            <div className="checkout-head">
              <i className="material-icons">receipt_long</i>
              <h2>Resumen del pedido</h2>
            </div>

            <ul className="checkout-items">
              {items.map((item) => (
                <li className="checkout-item" key={tiendaKey(item.id, 'ck')}>
                  <div className="checkout-item-detail">
                    <span className="checkout-item-name">{item.name}</span>
                    <span className="checkout-item-meta">Cantidad: {item.qty} × {formatPrice(item.price)}</span>
                  </div>
                  <span className="checkout-item-total">{formatPrice(item.price * item.qty)} COP</span>
                </li>
              ))}
            </ul>

            <div className="checkout-totals">
              <div className="ck-row"><span>Subtotal</span><span>{formatPrice(subtotal)} COP</span></div>
              <div className="ck-row"><span>Envío{shippingCost === 0 ? ' (gratis)' : ''}</span><span>{formatPrice(shippingCost)} COP</span></div>
              <div className="ck-row ck-row--total"><span>Total</span><span>{formatPrice(total)} COP</span></div>
            </div>

            <button className="cart-checkout-btn" onClick={handleNext}>
              Continuar con la compra
            </button>
          </>
        )}

        {/* STEP 2 — Formulario */}
        {step === 'form' && (
          <>
            <div className="checkout-head">
              <i className="material-icons">person</i>
              <h2>Datos de entrega</h2>
            </div>

            <form className="checkout-form" onSubmit={handleSubmit}>
              {payError && (
                <div className="checkout-error" role="alert">
                  <i className="material-icons">error_outline</i>
                  {payError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="ck-phone">Teléfono</label>
                <input
                  id="ck-phone"
                  type="tel"
                  required
                  placeholder="+57 300 000 0000"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ck-city">Ciudad</label>
                <input
                  id="ck-city"
                  type="text"
                  required
                  placeholder="Neiva"
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ck-address">Dirección de entrega</label>
                <input
                  id="ck-address"
                  type="text"
                  required
                  placeholder="Calle, número, barrio"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Método de pago</label>
                <div className="payment-methods">
                  {[
                    { value: 'card', icon: 'credit_card', label: 'Tarjeta' },
                    { value: 'pse', icon: 'account_balance', label: 'PSE' },
                    { value: 'cash', icon: 'payments', label: 'Contraentrega' },
                  ].map((m) => (
                    <label
                      key={m.value}
                      className={`payment-method ${form.method === m.value ? 'payment-method--active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={m.value}
                        checked={form.method === m.value}
                        onChange={(e) => setForm({ ...form, method: e.target.value })}
                      />
                      <i className="material-icons">{m.icon}</i>
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="checkout-actions">
                <button type="button" className="btn-secondary" onClick={handlePrev}>
                  Volver
                </button>
                <button type="submit" className="cart-checkout-btn">
                  Pagar {formatPrice(total)} COP
                </button>
              </div>
            </form>
          </>
        )}

        {/* STEP 3 — Procesando */}
        {step === 'processing' && (
          <div className="checkout-processing">
            <div className="spinner-ring" />
            <p>Procesando tu pago…</p>
            <span>Esto puede tardar unos segundos</span>
          </div>
        )}
      </section>
    </div>
  )
}

/* ── Purchase success overlay ───────────── */

function PurchaseSuccess() {
  return (
    <div className="success-overlay">
      <div className="success-box">
        <div className="success-icon">
          <i className="material-icons">check_circle</i>
        </div>
        <h2>¡Compra realizada!</h2>
        <p>Tu pedido ha sido procesado exitosamente.<br />Recibirás un correo de confirmación pronto.</p>
      </div>
    </div>
  )
}
