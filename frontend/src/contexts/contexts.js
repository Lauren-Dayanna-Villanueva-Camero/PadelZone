import { createContext } from 'react'

// Los objetos de contexto viven aparte de los Providers para que Fast Refresh
// funcione (un archivo .jsx solo debe exportar componentes).
export const AuthContext = createContext(null)
export const AdminContext = createContext(null)
