# TAXIMAST WEB

Sistema complementario para la plataforma **Taximast**. Este sistema fue diseñado para gestionar e integrar la API oficial de WhatsApp Business, reemplazando la antigua integración no oficial basada en una API pirata que quedó descontinuada. Su propósito principal es actuar como una interfaz moderna y centralizada donde los operadores pueden administrar las comunicaciones con clientes de múltiples líneas de taxis de forma ágil y en tiempo real.

---

## 🚀 Características Principales

Debido a que la API oficial de WhatsApp Business está orientada al manejo de mensajes vía APIs o webhooks (código) y no provee una interfaz de mensajería (como la app de celular clásica), **Taximast Web** provee el entorno visual e interactivo necesario:

- 💬 **Chat en Tiempo Real:** Interfaz para operadores con comunicación instantánea usando WebSockets (`Socket.io`), garantizando la misma fluidez que una aplicación de mensajería nativa.
- 📞 **Integración de Llamadas y Notificaciones:** Canal centralizado de atención al cliente para solicitudes de unidades (carreras).
- 🗄️ **Registro e Historial Detallado:** Almacenamiento persistente de las conversaciones, historiales de interacciones con los clientes y datos clave en la base de datos (MongoDB).
- 🔐 **Sesiones Independientes de Operadores:** Cada operador de turno posee su propio acceso y sesión, permitiendo rastrear la carga de trabajo y quién atendió a qué cliente.
- 🏢 **Arquitectura Multi-Línea:** Capacidad de administrar datos, operadores y clientes de **distintas líneas de taxis** dentro de un mismo sistema centralizado, aislando o agrupando la información según corresponda.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** [Next.js](https://nextjs.org/) (React), estilizado con [Tailwind CSS](https://tailwindcss.com/) y componentes base de [HeroUI](https://www.heroui.com/).
- **Backend / Real-time:** Arquitectura Fullstack con Next.js (API Routes), complementada con [Socket.io](https://socket.io/) para comunicación bidireccional en tiempo real *(pendiente)*.
- **Base de Datos:** [MongoDB](https://www.mongodb.com/) gestionado a través de **Mongoose**.
- **Autenticación:** JWT firmado con `jsonwebtoken`, almacenado en cookie HttpOnly.
- **Integración:** [WhatsApp Business API Oficial](https://developers.facebook.com/docs/whatsapp) para envío y recepción de mensajes.

---

## 🗃️ Estructura de la Base de Datos (Modelos)

Colecciones en MongoDB definidas mediante esquemas Mongoose en `/models`:

| Modelo | Descripción |
|---|---|
| `Lineas` | Configuración de cada empresa/línea de taxis (credenciales WhatsApp, tokens de Meta) |
| `Operadores` | Usuarios del sistema con roles (`admin`, `operador`, `admin_linea`) y estado de turno |
| `Mensajes` | Cada mensaje individual del chat; referencia línea, operador, cliente y estado de entrega |

> 📌 Modelos planificados pero aún no creados: `Unidades` (vehículos), `Conductores`.

---

## 🔐 Sistema de Roles

| Rol | Acceso |
|---|---|
| `admin` | Panel completo: todas las líneas, todos los chats, estadísticas globales, gestión de operadores y líneas |
| `admin_linea` | Panel de su línea: chats de su línea, estadísticas de su línea, gestión de operadores de su línea |
| `operador` | Solo chats de su línea asignada |

---

## 🗺️ Arquitectura de Rutas

```
/login                       → Todos los roles (público)
/dashboard                   → Todos los roles autenticados
/chat                        → Todos los roles (lista de chats + panel activo)
/chat/[numero]               → Chat individual con un contacto

/admin/operadores            → admin + admin_linea
/admin/lineas                → Solo admin
/admin/estadisticas          → Solo admin (global) / admin_linea (su línea)
```

---

## ✅ Estado del Desarrollo

### Completado

| Módulo | Descripción |
|---|---|
| **Login** (`/login`) | Página de inicio de sesión con validación, manejo de errores y redirección |
| **Auth JWT** | Generación, verificación y expiración (24h) de tokens JWT con cookie HttpOnly |
| **Middleware de rutas** (`proxy.ts`) | Protección de rutas por autenticación y rol; redirección automática según permisos |
| **Dashboard base** (`/dashboard`) | Vista de bienvenida con tarjetas de estadísticas (placeholders) y accesos rápidos según rol |
| **API Auth** | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| **API WhatsApp** | `POST /api/whatsapp/send`, `POST /api/whatsapp/send-bulk`, `GET /api/whatsapp/status`, `POST /api/whatsapp/webhook`, `POST /api/whatsapp/location` |
| **Modelos Mongoose** | `Lineas`, `Operadores`, `Mensajes` con índices optimizados |
| **Control de acceso por rol** | 3 roles en `JWTPayload` y `proxy.ts`: `admin`, `operador`, `admin_linea` |

---

### 🔲 Pendiente de Desarrollo

#### Vistas
| Vista | Rol | Estado |
|------------------------------------------------|------------------------|---------------|
| Vista de chat (`/chat`) -----------------------| Todos -----------------| ❌ Pendiente |
| Chat individual (`/chat/[numero]`) ------------| Todos -----------------| ❌ Pendiente |
| Panel admin — líneas (`/admin/lineas`) --------| `admin` ---------------| ❌ Pendiente |
| Panel admin — operadores (`/admin/operadores`) | `admin`, `admin_linea` | ❌ Pendiente |
| Estadísticas globales (`/admin/estadisticas`) | `admin` ----------------| ❌ Pendiente |
| Dashboard con datos reales -------------------| Todos ------------------| ❌ Pendiente |

#### APIs Faltantes
| Endpoint | Descripción |
|---|---|
| `GET /api/chats` | Lista de conversaciones agrupadas por contacto (con último mensaje y no leídos) |
| `GET /api/chats/[numero]` | Historial completo de mensajes de un contacto |
| `GET /api/admin/lineas` | Listar líneas (admin) |
| `POST /api/admin/lineas` | Crear/editar línea |
| `GET /api/admin/operadores` | Listar operadores (filtrado por línea si es admin_linea) |
| `POST /api/admin/operadores` | Crear/editar operador |
| `GET /api/admin/estadisticas` | Métricas globales o por línea |

#### Infraestructura
| Tarea | Estado |
|---|---|
| Servidor Socket.io para mensajes en tiempo real | ❌ Pendiente |
| Integración del webhook de WhatsApp con Socket.io (push a clientes conectados) | ❌ Pendiente |
| Campo `linea` opcional para rol `admin` (actualmente `required: true`) | ❌ Pendiente |
| Modelos `Unidades` y `Conductores` | ❌ Pendiente |
| Chatbot IA para respuesta automática de WhatsApp | ❌ Pendiente (largo plazo) |

---

## ⚙️ Desarrollo y Ejecución Local

1. Clonar el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar las variables de entorno (`.env`):

   | Variable | Descripción |
   |---|---|
   | `MONGODB_URI` | URI de conexión a MongoDB |
   | `JWT_SECRET` | Clave secreta para firma de tokens |
   | `WA_PHONE_NUMBER_ID` | Phone Number ID de Meta for Developers |
   | `WA_ACCESS_TOKEN` | System User Token de WhatsApp Business API |
   | `WA_VERIFY_TOKEN` | Token de verificación para el webhook de Meta |

4. Iniciar el entorno de desarrollo:
   ```bash
   npm run dev
   ```

El servidor correrá en `http://localhost:3000`.

---

## 🎨 Paleta de Colores

```css
--onyx:        #0b0c0c   /* Fondo principal */
--jet-black:   #2a2e34   /* Fondo de tarjetas */
--platinum:    #e9eaec   /* Texto principal */
--bright-gold: #fbe134   /* Acento primario */
--saffron:     #e4b61a   /* Acento secundario */
```

---

📝 *Última actualización: Febrero 2026 — Se refleja el estado real del proyecto incluyendo el sistema de autenticación, middleware de roles y APIs de WhatsApp implementadas.*