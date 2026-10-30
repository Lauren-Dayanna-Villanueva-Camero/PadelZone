# PadelZone 🎾

Aplicación web full‑stack para la gestión del club de pádel **PadelZone** (Neiva, Huila, Colombia). Permite a los usuarios reservar canchas, inscribirse en torneos y clases, comprar en la tienda del club y consultar el clima. Incluye un panel de administración completo.

## 👩‍💻 Autora

| Nombre | Código |
|---|---|
| Lauren Dayanna Villanueva Camero | 20241220012 |

Universidad Surcolombiana (USCO)

---

## 📋 Tabla de contenido

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Requisitos previos](#-requisitos-previos)
- [Instalación y ejecución](#-instalación-y-ejecución)
- [Variables de entorno](#-variables-de-entorno)
- [Datos de prueba](#-datos-de-prueba)
- [Rutas del frontend](#-rutas-del-frontend)
- [API REST](#-api-rest)
- [Pendientes](#-pendientes)

---

## ✨ Características

**Usuarios**
- Registro, inicio de sesión (JWT en cookie httpOnly) y recuperación de contraseña.
- Reserva de canchas con consulta de horarios ocupados y cancelación.
- Inscripción a torneos, individual o en pareja (`pareja_email`).
- Inscripción a clases y consulta de "Mis clases".
- Tienda con carrito de compras y pedidos.
- Perfil con pestañas: reservas, torneos, pedidos y clases.
- Página de clima en Neiva (API pública Open‑Meteo).

**Administración (`/admin`)**
- Estadísticas generales.
- CRUD de canchas, productos, torneos y slides del carrusel.
- Gestión de reservas, pedidos (cambio de estado) y usuarios (rol / activo).
- Biblioteca de imágenes (Cloudinary o MongoDB como respaldo).
- Torneos: cierre de inscripciones, emparejamiento automático, reorganización y exportación a Excel (`.xlsx`).

**Seguridad**
- Contraseñas con `bcryptjs`.
- Validación de datos con `zod`.
- Rate limiting en endpoints sensibles.
- Roles: `usuario`, `profesor`, `admin`.

---

## 🛠 Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | React 19, Vite, React Router 7, React‑Bootstrap / Bootstrap 5, Materialize CSS, Axios |
| Backend | Node.js, Express 5, Mongoose 9, JWT, bcryptjs, zod, multer, Cloudinary, ExcelJS, Morgan |
| Base de datos | MongoDB |

---

## 📁 Estructura del proyecto

```
PadelZone/
├── backend/
│   ├── scripts/
│   │   └── seed-prueba.js      # Carga de datos de prueba
│   └── src/
│       ├── controllers/        # Lógica de cada recurso
│       ├── libs/               # JWT, Cloudinary, emparejamiento de torneos
│       ├── middlewares/        # Auth, rate limit, subida de archivos, validación
│       ├── models/             # Esquemas de Mongoose
│       ├── routes/             # Definición de endpoints
│       ├── schema/             # Esquemas de validación (zod)
│       ├── config.js
│       ├── db.js
│       └── index.js            # Punto de entrada del servidor
└── frontend/
    ├── public/
    └── src/
        ├── components/         # Navbar, Footer, Carrusel, etc.
        ├── contexts/           # AuthContext, AdminContext
        ├── hooks/              # useAuth, useAdmin, useCanchas
        ├── pages/              # Home, Reservas, Torneos, Clases, Tienda, Admin, ...
        ├── services/api.js     # Cliente Axios
        └── utils/
```

---

## ✅ Requisitos previos

- [Node.js](https://nodejs.org/) 20 o superior
- [MongoDB](https://www.mongodb.com/) local o en la nube (MongoDB Atlas)
- (Opcional) Cuenta de [Cloudinary](https://cloudinary.com/) para alojar imágenes

---

## 🚀 Instalación y ejecución

```bash
git clone https://github.com/Lauren-Dayanna-Villanueva-Camero/PadelZone.git
cd PadelZone
```

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # y completar los valores
npm run dev              # http://localhost:5000
```

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

Otros scripts del frontend:

```bash
npm run build     # build de producción en dist/
npm run preview   # previsualizar el build
npm run lint      # ESLint
```

> En Windows también puede usarse `frontend/start.bat`, que instala dependencias e inicia el frontend.

---

## 🔐 Variables de entorno

Los archivos `.env` **no se suben al repositorio**. Usa los `.env.example` como plantilla.

### `backend/.env`

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | No | Puerto del servidor (por defecto `5000`) |
| `MONGODB_URI` | **Sí** | Cadena de conexión a MongoDB |
| `JWT_SECRET` | **Sí** | Secreto para firmar los tokens |
| `NODE_ENV` | No | `development` o `production` |
| `CLIENT_URL` | No | URL del frontend para CORS (por defecto `http://localhost:5173`) |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary; si falta, las imágenes se guardan en MongoDB |
| `CLOUDINARY_API_KEY` | No | |
| `CLOUDINARY_API_SECRET` | No | |

Límite de imágenes: 10 MB en Cloudinary y 5 MB en MongoDB. Al arrancar se verifica Cloudinary; si falla se usa MongoDB.

### `frontend/.env`

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend (por defecto `http://localhost:5000/api`) |

---

## 🧪 Datos de prueba

Desde `backend/`:

```bash
npm run seed              # crea los datos de prueba
npm run seed -- --reset   # borra los datos creados por el script
```

Crea los usuarios `usuario1@padelzone.com` … `usuario40@padelzone.com` (contraseña `123456`; `usuario40` queda inactivo), canchas, productos, torneos en todos sus estados, reservas, pedidos, inscripciones a clases y slides del carrusel.

---

## 🧭 Rutas del frontend

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | Inicio | Público |
| `/canchas` | Canchas del club | Público |
| `/torneos` | Torneos e inscripciones | Público |
| `/clases` | Clases | Público |
| `/tiendas` | Tienda | Público |
| `/clima` | Clima en Neiva | Público |
| `/contacto` | Contacto | Público |
| `/login`, `/registro` | Autenticación | Solo sin sesión |
| `/restablecer/:token` | Restablecer contraseña | Público |
| `/reservar` | Reservar cancha | Usuario autenticado |
| `/perfil` | Perfil del usuario | Usuario autenticado |
| `/admin/*` | Panel: reservas, pedidos, canchas, productos, torneos, carrusel, media, usuarios | Administrador |

---

## 🔌 API REST

Base: `http://localhost:5000/api`

| Recurso | Endpoints |
|---|---|
| **Auth** `/auth` | `POST /register`, `POST /login`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`, `GET /profile`, `PUT /profile` |
| **Canchas** `/canchas` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Reservas** `/reservas` | `GET /ocupados`, `GET /`, `GET /:id`, `POST /`, `PUT /:id/cancelar`, `DELETE /:id` |
| **Productos** `/productos` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Pedidos** `/pedidos` | `GET /`, `GET /:id`, `POST /`, `PUT /:id/estado`, `PUT /:id/cancelar` |
| **Torneos** `/torneos` | `GET /`, `GET /:id`, `GET /mis-inscripciones`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/inscribir`, `DELETE /:id/cancelar-inscripcion`, `PUT /:id/cerrar-inscripciones`, `PUT /:id/reorganizar`, `PUT /:id/participantes/:participanteId`, `GET /:id/exportar` |
| **Clases** `/clases` | `GET /mis-inscripciones`, `GET /inscripciones`, `POST /inscripciones`, `PUT /inscripciones/:id/cancelar` |
| **Carrusel** `/carrusel` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Media** `/media` | `GET /`, `GET /:id`, `GET /:id/archivo`, `POST /upload`, `DELETE /:id` |
| **Admin** `/admin` | `GET /stats`, `GET /usuarios`, `PUT /usuarios/:id` |

Las operaciones de escritura sobre catálogos (canchas, productos, torneos, carrusel, media) y todo `/admin` requieren rol de administrador.

---

## 📌 Pendientes

- Integrar una pasarela de pago real (hoy el pago de clases y tienda es simulado).
- Envío del correo de recuperación por SMTP (en desarrollo se devuelve el enlace en la respuesta).
- Rate limit en memoria; usar Redis si se despliegan varias instancias.
- Cupos de clases dinámicos y gestión de clases desde el panel de administración.
