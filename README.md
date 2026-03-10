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

| Modelo | Descripción |
|---|---|
| `Lineas` | Configuración de cada empresa/línea de taxis (credenciales WhatsApp, tokens de Meta, API Key y prompt de Gemini) |
| `Operadores` | Usuarios del sistema con roles (`admin`, `operador`, `admin_linea`) y estado de turno |
| `Conductores` | Registro de conductores por línea con datos de contacto, unidad y foto de identificación |
| `Chats` | Conversaciones con mensajes embebidos, estado del ciclo de vida (`pendiente` → `bot_atendiendo` → `esperando_operador` → `en_atencion` → `cerrado`) |

---

## 🔐 Sistema de Roles

| Rol | Acceso |
|---|---|
| `admin` | Panel completo: todas las líneas, todos los chats, estadísticas globales, gestión de operadores, líneas y conductores |
| `admin_linea` | Panel de su línea: chats de su línea, estadísticas de su línea, gestión de operadores y conductores de su línea |
| `operador` | Solo chats de su línea asignada |

---

## 🗺️ Arquitectura de Rutas Princpales

```
/login                       → Todos los roles (público)
/dashboard                   → Todos los roles autenticados
/chat                        → Todos los roles (lista de chats + panel activo)

/admin/operadores            → admin + admin_linea
/admin/lineas                → Solo admin
/admin/conductores           → admin + admin_linea
/admin/estadisticas          → Solo admin (global) / admin_linea (su línea)

/api/whatsapp/dispatch       → Endpoint para despacho desde TaxiMast Desktop
/api/whatsapp/dispatch-bulk  → Endpoint para avisos masivos desde Desktop
```

---

## ✅ Estado del Desarrollo (Marzo 2026)

### Completado
#### Vistas y Frontend 🖥️
| Vista | Rol | Estado |
|---|---|---|
| **Módulo de Chat Real-time** | Todos | ✅ Completado |
| **Panel de Líneas** | `admin` | ✅ Completado |
| **Panel de Operadores** | `admin`, `admin_linea` | ✅ Completado |
| **Panel de Conductores** | `admin`, `admin_linea` | ✅ Completado |
| **Estadísticas Dinámicas** | `admin`, `admin_linea` | ✅ Completado |
| **Gestión de Multimedia** | Operadores | ✅ Completado |

#### Integración de IA y Lógica 🤖
| Tarea | Estado | Descripción |
|---|---|---|
| **Interacción con Gemini** | ✅ Completado | Ciclo de vida completo, clasificación de intención y handoff automático. |
| **Filtro de Líneas Inactivas** | ✅ Completado | El webhook ignora mensajes de líneas marcadas como inactivas en el panel. |
| **Normalización de Teléfonos** | ✅ Completado | Manejo inteligente de prefijos (58/0) para compatilidad FoxPro vs WhatsApp Cloud API. |

#### Integración Desktop (TaxiMast) 🚀
| Tarea | Estado | Descripción |
|---|---|---|
| **API de Despacho** | ✅ Completado | Nuevo endpoint `/api/whatsapp/dispatch` diseñado para el payload de FoxPro. |
| **Integración PocketBase** | ✅ Completado | Almacenamiento seguro de fotos de conductores en servidor externo PocketBase. |
| **Envío de Fotos de Chófer** | ✅ Completado | Envío automático de la foto del chófer al cliente cuando se despacha la unidad. |
| **Status con Validación** | ✅ Completado | Endpoint `/api/whatsapp/status` que valida la existencia y estado de la línea. |

---

## ⚙️ Configuración del Entorno (`.env`)

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | URI de conexión a la base de datos |
| `JWT_SECRET` | Secreto para tokens de sesión |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación para Webhooks de Meta |
| `NEXT_PUBLIC_PB_URL` | URL de la instancia de PocketBase (fotos) |
| `PB_ADMIN_EMAIL` | Email administrador de PocketBase |
| `PB_ADMIN_PASS` | Password administrador de PocketBase |

---

## 🎨 Diseño Visual

El sistema utiliza un diseño **Premium Dark Mode** con acentos en oro brillante:

```css
--onyx:        #0b0c0c   /* Fondo principal */
--jet-black:   #2a2e34   /* Tarjetas y Modales */
--bright-gold: #fbe134   /* Botones y Títulos */
```

---

📝 *Última actualización: 9 de Marzo de 2026 — Despacho con fotos integrado (PocketBase), Módulo de Conductores y Filtro de Líneas activas.*