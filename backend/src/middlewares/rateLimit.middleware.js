// Límite de peticiones en memoria, por IP y por ruta. Suficiente para un solo proceso;
// con varias instancias habría que usar un almacén compartido (p. ej. Redis).
export const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map()

  // Limpieza periódica para que el mapa no crezca indefinidamente
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key)
    }
  }, windowMs).unref()

  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`
    const now = Date.now()
    let entry = hits.get(key)

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }

    entry.count++
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ message })
    }
    next()
  }
}
