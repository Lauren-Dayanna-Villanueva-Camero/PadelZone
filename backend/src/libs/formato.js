// "$45.000" (pesos colombianos sin decimales)
export const formatoPesos = (valor) => `$${Math.round(valor || 0).toLocaleString('es-CO')}`
