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
- Registro e inicio de sesión con email y contraseña o con Google (JWT en cookie httpOnly). Si el email de Google ya tiene cuenta, se vinculan.
- Recuperación de contraseña por correo (Gmail): enlace de un solo uso que vence en 1 hora, y aviso cuando la contraseña cambia. Las cuentas creadas con Google pueden crear una contraseña con el mismo flujo.
- Reserva de canchas con consulta de horarios ocupados y cancelación. Las franjas que un torneo tiene apartadas no se pueden reservar.
- Inscripción a torneos, individual o en pareja (`pareja_email`), dentro de su periodo de inscripciones (apertura y cierre). Antes de la apertura el torneo sale como "Próximamente".
- Torneos con submenú: Torneos disponibles, Mis inscripciones (mi equipo y cuadro de eliminación), Mis partidos (día, hora, cancha, rival y resultado de cada partido) y Organiza tu torneo.
- Empresas u organizadores pueden solicitar un torneo: alquiler de canchas por bloque (canchas × horas por día × días) o convenio de 3, 6 o 12 meses con 10, 15 o 20 % de descuento, con cotización, capacidad de partidos y disponibilidad en vivo. Pueden ver y cancelar sus solicitudes.
- Torneos privados de empresas u organizaciones: solo se inscribe quien tenga el código de acceso (formato `XXXX-XXXX`). La empresa lo ve en "Mis solicitudes", puede copiarlo o compartir un enlace de invitación (`/torneos?torneo=<id>&codigo=<código>`) y regenerarlo si se filtra. Quien fue declarado como pareja por alguien con código no lo necesita.
- Inscripción a clases y consulta de "Mis clases".
- Tienda con carrito de compras y pedidos.
- Pagos en línea (tarjeta, PSE, Nequi) o en efectivo en la sede / contraentrega, para reservas, pedidos, inscripciones a torneos y clases. Se puede pagar al momento o más tarde desde el perfil, y cada pago deja un comprobante.
- Las reservas quedan apartadas 15 minutos mientras se paga; si no se paga (ni se elige pagar en la sede) se liberan solas.
- Calendario visual (mes, semana y lista) con mis reservas, partidos, torneos y clases.
- Perfil con pestañas: reservas, torneos, pedidos, pagos (por pagar e historial), calendario y datos.
- Página de clima en Neiva (API pública Open‑Meteo).

**Administración (`/admin`)**
- Estadísticas generales.
- CRUD de canchas, productos, torneos y slides del carrusel.
- Gestión de reservas, pedidos (cambio de estado) y usuarios (rol / activo).
- Calendario de todo el club (reservas, partidos y torneos) con filtro por cancha. Las reservas sin pagar se ven con borde punteado.
- Pagos: recaudado, efectivo por confirmar, pagos por reembolsar (pagados pero cancelados) y totales por método; filtros, confirmación de pagos en efectivo y anulación/reembolso.
- Biblioteca de imágenes (Cloudinary o MongoDB como respaldo).
- Torneos:
  - Periodo de inscripciones; se cierran solas al pasar la fecha de cierre o al llenarse el cupo, y el admin también puede cerrarlas a mano.
  - Al cerrar se forman las parejas (se respetan las declaradas y el resto se sortea) y se arma el cuadro de eliminación. Si el número de parejas no es potencia de 2, algunas pasan directo (BYE).
  - Cada partido recibe fecha, hora y cancha según los días, la franja diaria, la duración de los partidos y las canchas del torneo. El admin puede ajustar cada horario o recalcularlos todos.
  - Resultados en el cuadro: el ganador pasa a la ronda siguiente hasta el campeón.
  - Reorganizar parejas, confirmar pagos y exportar a Excel (`.xlsx`).
  - Torneos privados: al marcarlos se genera el código de acceso, que el admin ve y puede regenerar.
- Solicitudes de torneo de empresas: el admin ve los cruces con reservas u otros torneos y aprueba (se crea el torneo y las canchas quedan apartadas) o rechaza con un motivo. Si la empresa pidió un torneo privado, al aprobar se genera su código.

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
│       ├── libs/               # JWT, Cloudinary, torneos (parejas, cuadro, horarios), solicitudes, franjas horarias, pagos, clases y códigos de acceso
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
        ├── components/         # Navbar, Footer, Carrusel, Cuadro (cuadro de eliminación), Calendario, Pago, CodigoAcceso, etc.
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
| `GMAIL_USER` | No | Cuenta de Gmail que envía los correos de recuperación |
| `GMAIL_APP_PASSWORD` | No | Contraseña de aplicación de esa cuenta (16 letras; los espacios se ignoran) |
| `MAIL_FROM_NAME` | No | Nombre del remitente (por defecto `PadelZone`) |
| `GOOGLE_CLIENT_ID` | No | Client ID de Google para "Continuar con Google" (el mismo del frontend) |
| `WOMPI_PUBLIC_KEY` | No | Llave pública de Wompi (`pub_test_...` o `pub_prod_...`). Sin ella los pagos en línea son simulados |
| `WOMPI_INTEGRITY_SECRET` | No | Secreto de integridad de Wompi (firma de cada pago) |
| `WOMPI_EVENTS_SECRET` | No | Secreto de eventos de Wompi (verifica el webhook) |

Límite de imágenes: 10 MB en Cloudinary y 5 MB en MongoDB. Al arrancar se verifica Cloudinary; si falla se usa MongoDB.

### `frontend/.env`

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend (por defecto `http://localhost:5000/api`) |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google; si está vacío no se muestra el botón de Google |

### Correo de recuperación (Gmail)

1. En la cuenta de Gmail que enviará los correos, activa la verificación en dos pasos.
2. Crea una contraseña de aplicación en <https://myaccount.google.com/apppasswords>.
3. Pon el correo en `GMAIL_USER` y la contraseña en `GMAIL_APP_PASSWORD`. Al arrancar, el backend verifica la conexión y lo indica en consola.

Si no se configura, en desarrollo el enlace de recuperación se muestra en la consola del backend y en la ventana de "¿Olvidaste tu contraseña?". En producción la respuesta es siempre genérica, para no revelar qué emails están registrados.

### Pagos (Wompi)

Sin llaves de Wompi los pagos en línea funcionan en **modo de pruebas simulado** (no se cobra nada) con estas reglas:

| Método | Aprobado | Rechazado |
|---|---|---|
| Tarjeta | `4242 4242 4242 4242` (cualquier fecha futura y CVV) | `4111 1111 1111 1111` |
| Nequi | Cualquier celular | `399 222 2222` |
| PSE | Cualquier banco | "Banco que rechaza" |

Solo se guardan la marca y los últimos 4 dígitos de la tarjeta.

Para cobrar de verdad:

1. Crea una cuenta en <https://comercios.wompi.co> y copia, en **Desarrolladores**, la llave pública y los secretos de integridad y de eventos (empieza con las de pruebas, `pub_test_...`).
2. Ponlos en `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET`. `CLIENT_URL` debe ser la URL del frontend: Wompi vuelve a `CLIENT_URL/pagos/resultado`.
3. En Wompi, configura la URL de eventos: `https://<tu-backend>/api/pagos/wompi/eventos`.

El usuario paga en el checkout de Wompi; al volver, el backend consulta la transacción en Wompi y el webhook confirma los pagos aunque el usuario cierre la ventana. Al arrancar, el backend indica en consola qué modo de pagos usa.

El pago en efectivo queda pendiente hasta que el admin lo confirma en **Admin → Pagos**.

### Inicio de sesión con Google

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un proyecto y configura la pantalla de consentimiento de OAuth (tipo externo, con los permisos `email` y `profile`).
2. Crea unas credenciales de tipo **ID de cliente de OAuth → Aplicación web**.
3. En **Orígenes autorizados de JavaScript** agrega `http://localhost:5173` y la URL del frontend en producción. No hacen falta URIs de redirección.
4. Copia el Client ID en `GOOGLE_CLIENT_ID` (backend) y `VITE_GOOGLE_CLIENT_ID` (frontend). No se usa el client secret.

El backend verifica el ID token de Google; solo acepta emails verificados.

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
| Copa Empresarial Café Huila | Inscripciones abiertas, 2/4 parejas | Torneo **privado** de una empresa: código de acceso `CAFE-2026`. Muestra el organizador y aparta la Cancha 5. |

**Solicitudes de torneo de empresas** (pestaña "Solicitudes de empresas" del admin)

| Empresa (solicitante) | Estado | Qué permite probar |
|---|---|---|
| Huila Tech S.A.S. (`usuario5`) | Pendiente | Aprobarla crea el torneo y aparta la Cancha 4. |
| Colegio Santa Librada (`usuario11`) | Pendiente con cruce | Una reserva de `usuario3` se cruza con el horario, así que el admin no puede aprobarla. |
| Café Huila Exportaciones (`usuario8`) | Aprobada, convenio de 6 meses vigente | Al cotizar otro torneo en "Organiza tu torneo", `usuario8` recibe el 15 % de descuento del convenio. En "Mis solicitudes" ve el código del torneo privado y puede regenerarlo. |
| Distribuidora El Sol (`usuario9`) | Rechazada | Se ve el motivo del rechazo. |
| Gimnasio Fitness Neiva (`usuario10`) | Cancelada | Solicitud retirada por la empresa. |

**Usuarios útiles para la vista del jugador**

- `usuario1`: en el Open Profesional ganó su partido de cuartos y tiene la semifinal pendiente ("Mis partidos" y cuadro). También está inscrito en el Torneo Express.
- `usuario12`: declaró como pareja a `usuario39`, que no tiene inscripción propia; `usuario39` ve el torneo como "Te inscribió tu pareja".
- `usuario16` … `usuario21`: inscritos sin pareja en la Copa Comunidad.

**Otros datos:** unas 45 reservas pasadas y futuras (algunas canceladas, ninguna en franjas apartadas por torneos), 17 pedidos en todos los estados, 16 inscripciones a clases (una cancelada) y cerca de 100 pagos (aprobados, en efectivo por confirmar y algunos por reembolsar).

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
| `/perfil` | Perfil del usuario (`?tab=reservations`, `tournaments`, `orders`, `pagos`, `calendario`, `data`) | Usuario autenticado |
| `/pagos/resultado` | Resultado de un pago al volver de Wompi | Usuario autenticado |
| `/admin/*` | Panel: calendario, reservas, pagos, pedidos, canchas, productos, torneos (con solicitudes de empresas), carrusel, media y usuarios | Administrador |

---

## 🔌 API REST

Base: `http://localhost:5000/api`

| Recurso | Endpoints |
|---|---|
| **Auth** `/auth` | `POST /register`, `POST /login`, `POST /google`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`, `GET /profile`, `PUT /profile` |
| **Canchas** `/canchas` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Reservas** `/reservas` | `GET /ocupados`, `GET /`, `GET /:id`, `POST /`, `PUT /:id/cancelar`, `DELETE /:id` |
| **Productos** `/productos` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Pedidos** `/pedidos` | `GET /`, `GET /:id`, `POST /`, `PUT /:id/estado`, `PUT /:id/cancelar` |
| **Torneos** `/torneos` | `GET /`, `GET /:id`, `GET /mis-inscripciones`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/inscribir`, `DELETE /:id/cancelar-inscripcion`, `PUT /:id/cerrar-inscripciones`, `PUT /:id/reorganizar`, `PUT /:id/participantes/:participanteId`, `GET /:id/exportar`, `GET /:id/cuadro`, `PUT /:id/partidos/:partidoId`, `PUT /:id/partidos/:partidoId/horario`, `PUT /:id/reprogramar`, `GET /mis-partidos`, `PUT /:id/codigo` (regenerar código, admin) |
| **Solicitudes de torneo** `/solicitudes-torneo` | `POST /cotizar`, `POST /`, `GET /mias`, `PUT /:id/cancelar`, `PUT /:id/codigo` (la empresa regenera su código), `GET /` (admin), `PUT /:id/aprobar` (admin), `PUT /:id/rechazar` (admin) |
| **Pagos** `/pagos` | `GET /config`, `POST /` (iniciar pago), `POST /:id/simular`, `GET /wompi/verificar`, `POST /wompi/eventos` (webhook), `GET /mios`, `GET /:id`, `GET /` (admin), `PUT /:id/confirmar` (admin), `PUT /:id/anular` (admin) |
| **Calendario** `/calendario` | `GET /?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (máx. 62 días; el admin ve todo el club y puede filtrar con `cancha_id`) |
| **Clases** `/clases` | `GET /mis-inscripciones`, `GET /inscripciones`, `POST /inscripciones`, `PUT /inscripciones/:id/cancelar` |
| **Carrusel** `/carrusel` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| **Media** `/media` | `GET /`, `GET /:id`, `GET /:id/archivo`, `POST /upload`, `DELETE /:id` |
| **Admin** `/admin` | `GET /stats`, `GET /usuarios`, `PUT /usuarios/:id` |

Las operaciones de escritura sobre catálogos (canchas, productos, torneos, carrusel, media) y todo `/admin` requieren rol de administrador.

---

## 📌 Pendientes

- Configurar las llaves de Wompi (primero las de pruebas) para pasar de pagos simulados a reales.
- Los reembolsos se marcan en el sistema, pero el dinero se devuelve a mano desde el panel de Wompi o en la sede.
- Rate limit en memoria; usar Redis si se despliegan varias instancias.
- Cupos de clases dinámicos y gestión de clases desde el panel de administración.
