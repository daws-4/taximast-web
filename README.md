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
| `Lineas` | Configuración de cada empresa/línea de taxis (credenciales WhatsApp, tokens de Meta, API Key y prompt de Gemini) |
| `Operadores` | Usuarios del sistema con roles (`admin`, `operador`, `admin_linea`) y estado de turno |
| `Chats` | Conversaciones con mensajes embebidos, estado del ciclo de vida (`pendiente` → `bot_atendiendo` → `esperando_operador` → `en_atencion` → `cerrado`) |

> 📌 Modelos planificados pero aún no creados: `Unidades`, `Conductores` (ver sección Pendientes).

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
#### Vistas 🖥️
| Vista | Rol | Estado |
|------------------------------------------------|------------------------|---------------|
| Módulo de Chat Integral (`/chat` & `/[numero]`) | Todos -----------------| ✅ Completado |
| Panel admin — líneas (`/admin/lineas`) --------| `admin` ---------------| ✅ Completado |
| Panel admin — operadores (`/admin/operadores`) | `admin`, `admin_linea` | ✅ Completado |
| Estadísticas globales (`/admin/estadisticas`) | `admin` ----------------| ✅ Completado |
| Módulo | Descripción |
|---|---|
| **Landing Page** (`/`) | Página promocional del ecosistema TAXIMAST con tema oscuro institucional |
| **Login** (`/login`) | Página de inicio de sesión con validación, manejo de errores y redirección |
| **Auth JWT** | Generación, verificación y expiración (24h) de tokens JWT con cookie HttpOnly |
| **Middleware de rutas** (`proxy.ts`) | Protección de rutas por autenticación y rol; redirección automática según permisos |
| **Dashboard base** (`/dashboard`) | Vista de bienvenida base (en proceso de integración de datos) |
| **API Auth** | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| **API WhatsApp** | Recepción básica y envío (estructura base en API route) |
| **Modelos Mongoose** | `Lineas`, `Operadores`, `Mensajes`, `Chats` con índices optimizados |
| **Control de acceso por rol** | 3 roles en `JWTPayload` y `proxy.ts`: `admin`, `operador`, `admin_linea` |

---

#### Integración de Inteligencia Artificial 🤖
| Tarea | Estado | Descripción |
|---|---|---|
| **Integración Directa de Google Gemini** | ✅ Completado | SDK de Gemini 2.5 Flash integrado en el backend para respuestas automáticas al cliente. |
| **Gestión de API Keys por Línea** | ✅ Completado | Cada línea puede tener su propia API Key de Gemini (facturación independiente). |
| **Ciclo de vida de estados del chat** | ✅ Completado | 5 estados: `pendiente` → `bot_atendiendo` → `esperando_operador` → `en_atencion` → `cerrado`, con transiciones automáticas y reapertura de chats cerrados. |
| **Separación de pensamiento de la IA** | ✅ Completado | El razonamiento interno (chain-of-thought) de Gemini se guarda para los operadores pero NUNCA se envía al cliente. |
| **Clasificación de solicitudes** | ✅ Completado | La IA clasifica automáticamente entre: traslado, objeto perdido, queja/sugerencia, y actúa en consecuencia. |
| **Handoff automático IA → Operador** | ✅ Completado | Detección interna con etiqueta `[LISTO]` para cambiar automáticamente a `esperando_operador`. |

#### Comunicaciones y Chat 💬
| Tarea | Estado / Prioridad | Descripción |
|---|---|---|
| **Estados de Mensajes** | ✅ Completado | Estados visuales: Enviado, Entregado, Leído, Pendiente, Fallido. |
| **Multimedia (Imágenes y Stickers)** | ✅ Completado | Envío y recepción de imágenes, stickers, audio, video y documentos. |
| **Filtros y Búsqueda** | ✅ Completado | Búsqueda por nombre/teléfono y filtro por estado del chat. |
| **Llamadas de WhatsApp** | ❌ Pendiente (BAJA) | Registrar o manejar avisos de llamadas entrantes por WhatsApp. |

#### Módulo de Conductores 🚕 (PENDIENTE)
| Tarea | Estado | Descripción |
|---|---|---|
| **Modelo `Conductores`** | ❌ Pendiente | Colección con datos del conductor: nombre, cédula, teléfono, unidad, foto de identificación. |
| **API CRUD** | ❌ Pendiente | Endpoints para crear, listar, editar y eliminar conductores. Upload de foto. |
| **Admin UI** | ❌ Pendiente | Panel admin con tabla, modal de creación/edición y upload de imagen. |
| **Separación de chats** | ❌ Pendiente | Diferenciar chats de clientes vs conductores en el sidebar. Los chats de conductores NO activan la IA. |
| **Envío de servicios** | ❌ Pendiente | Permitir al operador enviar datos de un servicio (pasajero, origen, destino) al conductor asignado. |

#### Infraestructura
| Tarea | Estado |
|---|---|
| Servidor Socket.io para mensajes en tiempo real | ✅ Completado |
| Integración del webhook de WhatsApp con Socket.io (push a clientes conectados) | ✅ Completado |
| Lógica de líneas sin IA (status directo a `esperando_operador`) | ✅ Completado |
| Modelo `Conductores` | ❌ Pendiente |
| Modelo `Unidades` | ❌ Pendiente |

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
   | `GEMINI_API_KEY` | (Próximamente) Clave maestra para IA en caso de fallback |

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

📝 *Última actualización: Marzo 2026 — Ciclo de vida del chat con IA, handoff automático, módulo de Conductores planificado.*