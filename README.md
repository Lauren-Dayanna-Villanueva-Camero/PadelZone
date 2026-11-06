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
- Reserva de canchas con consulta de horarios ocupados y cancelación. Las franjas que un torneo tiene apartadas no se pueden reservar.
- Inscripción a torneos, individual o en pareja (`pareja_email`), dentro de su periodo de inscripciones (apertura y cierre). Antes de la apertura el torneo sale como "Próximamente".
- Torneos con submenú: Torneos disponibles, Mis inscripciones (mi equipo y cuadro de eliminación), Mis partidos (día, hora, cancha, rival y resultado de cada partido) y Organiza tu torneo.
- Empresas u organizadores pueden solicitar un torneo: alquiler de canchas por bloque (canchas × horas por día × días) o convenio de 3, 6 o 12 meses con 10, 15 o 20 % de descuento, con cotización, capacidad de partidos y disponibilidad en vivo. Pueden ver y cancelar sus solicitudes.
- Inscripción a clases y consulta de "Mis clases".
- Tienda con carrito de compras y pedidos.
- Perfil con pestañas: reservas, torneos, pedidos y clases.
- Página de clima en Neiva (API pública Open‑Meteo).

**Administración (`/admin`)**
- Estadísticas generales.
- CRUD de canchas, productos, torneos y slides del carrusel.
- Gestión de reservas, pedidos (cambio de estado) y usuarios (rol / activo).
- Biblioteca de imágenes (Cloudinary o MongoDB como respaldo).
- Torneos:
  - Periodo de inscripciones; se cierran solas al pasar la fecha de cierre o al llenarse el cupo, y el admin también puede cerrarlas a mano.
  - Al cerrar se forman las parejas (se respetan las declaradas y el resto se sortea) y se arma el cuadro de eliminación. Si el número de parejas no es potencia de 2, algunas pasan directo (BYE).
  - Cada partido recibe fecha, hora y cancha según los días, la franja diaria, la duración de los partidos y las canchas del torneo. El admin puede ajustar cada horario o recalcularlos todos.
  - Resultados en el cuadro: el ganador pasa a la ronda siguiente hasta el campeón.
  - Reorganizar parejas, confirmar pagos y exportar a Excel (`.xlsx`).
- Solicitudes de torneo de empresas: el admin ve los cruces con reservas u otros torneos y aprueba (se crea el torneo y las canchas quedan apartadas) o rechaza con un motivo.

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
│       ├── libs/               # JWT, Cloudinary, torneos (parejas, cuadro, horarios), solicitudes y franjas horarias
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
        ├── components/         # Navbar, Footer, Carrusel, Cuadro (cuadro de eliminación), etc.
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

Si los datos ya existen, `npm run seed` no hace nada: primero hay que borrarlos con `--reset`. Las fechas se calculan desde el día en que se ejecuta, así que los estados siempre quedan bien.

> ⚠️ Si `MONGODB_URI` apunta a la base real, el seed escribe en ella. Para probar sin tocarla, usa una base local o una base aparte en Atlas. Si hay Cloudinary configurado, las imágenes del seed también se suben allí.

**Cuentas** (contraseña `123456` en todas)

| Cuenta | Para qué sirve |
|---|---|
| Admin existente | El seed usa el primer admin activo de la base. Si no hay ninguno, crea `admin.prueba@padelzone.com`, que se borra con `--reset`. |
| `usuario1` … `usuario39@padelzone.com` | Usuarios normales con reservas, pedidos, clases y torneos (ver abajo). |
| `usuario40@padelzone.com` | Usuario inactivo: el inicio de sesión se rechaza. |

**Catálogo:** 3 canchas (2, 4 y 5), 12 productos (incluye uno agotado, uno inactivo y uno con una sola unidad) y 3 slides del carrusel.

**Torneos**

| Torneo | Estado | Qué permite probar |
|---|---|---|
| Torneo Amateur de Noviembre | Inscripciones abiertas, 6/8 parejas | Canchas 2 y 4 apartadas de 8:00 a 14:00: reservar ahí esos días da error. Tiene una pareja declarada sin inscripción propia (usuario12 → usuario39) y, al cerrar inscripciones, queda un jugador sin pareja. |
| Copa Comunidad PadelZone | Inscripciones abiertas, 3/4 parejas | Una inscripción más con email de pareja llena el cupo y el torneo se cierra solo. |
| Open Profesional PadelZone 2026 | En curso | Cuartos jugados con ganadores, semifinales programadas y la final sin horario ("por definir") para ajustarla en la pestaña Horarios. Canchas 2 y 4 apartadas de 16:00 a 22:00. |
| Torneo Express Cierre Automático | Activo con el cierre vencido | La primera consulta a la API cierra las inscripciones sola y arma parejas, cuadro y horarios. Queda un jugador sin pareja. |
| Liga de Verano 2026 | Finalizado | Cuadro completo con campeón y 2 BYE (6 parejas en un cuadro de 8). |
| Torneo Relámpago Halloween | Cancelado | Cómo se ve un torneo cancelado en las inscripciones del usuario. |
| Gran Torneo Navideño | Próximamente | Las inscripciones aún no abren. Partidos de 60 minutos. |
| Copa Empresarial Café Huila | Inscripciones abiertas, 2/4 parejas | Torneo de una empresa aprobado: muestra el organizador y aparta la Cancha 5. |

**Solicitudes de torneo de empresas** (pestaña "Solicitudes de empresas" del admin)

| Empresa (solicitante) | Estado | Qué permite probar |
|---|---|---|
| Huila Tech S.A.S. (`usuario5`) | Pendiente | Aprobarla crea el torneo y aparta la Cancha 4. |
| Colegio Santa Librada (`usuario11`) | Pendiente con cruce | Una reserva de `usuario3` se cruza con el horario, así que el admin no puede aprobarla. |
| Café Huila Exportaciones (`usuario8`) | Aprobada, convenio de 6 meses vigente | Al cotizar otro torneo en "Organiza tu torneo", `usuario8` recibe el 15 % de descuento del convenio. |
| Distribuidora El Sol (`usuario9`) | Rechazada | Se ve el motivo del rechazo. |
| Gimnasio Fitness Neiva (`usuario10`) | Cancelada | Solicitud retirada por la empresa. |

**Usuarios útiles para la vista del jugador**

- `usuario1`: en el Open Profesional ganó su partido de cuartos y tiene la semifinal pendiente ("Mis partidos" y cuadro). También está inscrito en el Torneo Express.
- `usuario12`: declaró como pareja a `usuario39`, que no tiene inscripción propia; `usuario39` ve el torneo como "Te inscribió tu pareja".
- `usuario16` … `usuario21`: inscritos sin pareja en la Copa Comunidad.

**Otros datos:** unas 45 reservas pasadas y futuras (algunas canceladas, ninguna en franjas apartadas por torneos), 17 pedidos en todos los estados y 16 inscripciones a clases (una cancelada).

---

## 🧭 Rutas del frontend

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | Inicio | Público |
| `/canchas` | Canchas del club | Público |
| `/torneos` | Torneos disponibles. Con sesión: Mis inscripciones, Mis partidos y Organiza tu torneo (`?seccion=inscripciones`, `partidos`, `organiza`) | Público |
| `/clases` | Clases | Público |
| `/tiendas` | Tienda | Público |
| `/clima` | Clima en Neiva | Público |
| `/contacto` | Contacto | Público |
| `/login`, `/registro` | Autenticación | Solo sin sesión |
| `/restablecer/:token` | Restablecer contraseña | Público |
| `/reservar` | Reservar cancha | Usuario autenticado |
| `/perfil` | Perfil del usuario | Usuario autenticado |
| `/admin/*` | Panel: reservas, pedidos, canchas, productos, torneos (con solicitudes de empresas), carrusel, media y usuarios | Administrador |

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
| **Torneos** `/torneos` | `GET /`, `GET /:id`, `GET /mis-inscripciones`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/inscribir`, `DELETE /:id/cancelar-inscripcion`, `PUT /:id/cerrar-inscripciones`, `PUT /:id/reorganizar`, `PUT /:id/participantes/:participanteId`, `GET /:id/exportar`, `GET /:id/cuadro`, `PUT /:id/partidos/:partidoId`, `PUT /:id/partidos/:partidoId/horario`, `PUT /:id/reprogramar`, `GET /mis-partidos` |
| **Solicitudes de torneo** `/solicitudes-torneo` | `POST /cotizar`, `POST /`, `GET /mias`, `PUT /:id/cancelar`, `GET /` (admin), `PUT /:id/aprobar` (admin), `PUT /:id/rechazar` (admin) |
| **Clases** `/clases` | `GET /mis-inscripciones`, `GET /inscripciones`, `POST /inscripciones`, `PUT /inscripciones/:id/cancelar` |
| **Carrusel** `/carrusel` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Media** `/media` | `GET /`, `GET /:id`, `GET /:id/archivo`, `POST /upload`, `DELETE /:id` |
| **Admin** `/admin` | `GET /stats`, `GET /usuarios`, `PUT /usuarios/:id` |

Las operaciones de escritura sobre catálogos (canchas, productos, torneos, carrusel, media) y todo `/admin` requieren rol de administrador.

---

## 📌 Pendientes

- Integrar una pasarela de pago real (hoy el pago de clases, tienda e inscripción a torneos es simulado; el admin confirma los pagos de torneos a mano).
- Envío del correo de recuperación por SMTP (en desarrollo se devuelve el enlace en la respuesta).
- Rate limit en memoria; usar Redis si se despliegan varias instancias.
- Cupos de clases dinámicos y gestión de clases desde el panel de administración.
