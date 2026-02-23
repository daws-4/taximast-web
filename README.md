# TAXIMAST WEB

Sistema complementario para la plataforma **Taximast**. Este sistema fue diseñado para gestionar e integrar la API oficial de WhatsApp Business, reemplazando la antigua integración no oficial basaba en una API pirata que quedó descontinuada. Su propósito principal es actuar como una interfaz moderna y centralizada donde los operadores pueden administrar las comunicaciones con clientes de múltiples líneas de taxis de forma ágil y en tiempo real.

---

## 🚀 Características Principales (Implicaciones)

Debido a que la API oficial de WhatsApp Business está orientada al manejo de mensajes vía APIs o webhooks (código) y no provee una interfaz de mensajería (como la app de celular clásica), **Taximast Web** provee el entorno visual e interactivo necesario:

- 💬 **Chat en Tiempo Real:** Interfaz para operadores con comunicación instantánea usando WebSockets (`Socket.io`), garantizando la misma fluidez que una aplicación de mensajería nativa.
- 📞 **Integración de Llamadas y Notificaciones:** Canal centralizado de atención al cliente para solicitudes de unidades (carreras).
- 🗄️ **Registro e Historial Detallado:** Almacenamiento persistente de las conversaciones, historiales de interacciones con los clientes y datos clave en la base de datos (MongoDB).
- 🔐 **Sesiones Independientes de Operadores:** Cada operador de turno posee su propio acceso y sesión, permitiendo rastrear la carga de trabajo y quién atendió a qué cliente.
- 🏢 **Arquitectura Multi-Línea:** Capacidad de administrar datos, operadores y clientes de **distintas líneas de taxis** dentro de un mismo sistema centralizado, aislando o agrupando la información según corresponda para mantener el orden de la empresa matriz.

---

## 🛠️ Tecnologías Utilizadas

El stack tecnológico está enfocado en rendimiento, escalabilidad y una excelente experiencia de usuario:

- **Frontend:** [Next.js](https://nextjs.org/) (React), estilizado con [Tailwind CSS](https://tailwindcss.com/) y componentes base de [HeroUI](https://www.heroui.com/) para una interfaz veloz, moderna y accesible.
- **Backend / Real-time:** Arquitectura Fullstack con Next.js (Server Actions / API Routes), complementada con Servidor / Canales en Node.js usando [Socket.io](https://socket.io/) para comunicación bidireccional en tiempo real entre el servidor y los operadores.
- **Base de Datos:** [MongoDB](https://www.mongodb.com/) gestionado a través de **Mongoose** parar crear estructuras de datos escalables (JSON).
- **Integraciones Clave:** [WhatsApp Business API Oficial](https://developers.facebook.com/docs/whatsapp) para el envío y recepción de mensajes de manera segura y avalada por Meta.

---

## 🗃️ Estructura de la Base de Datos (Modelos)

El sistema hace uso de una base de datos no relacional (MongoDB) con colecciones estructuradas definidas a través de los **esquemas de Mongoose** en la carpeta `/models`. Las entidades primarias iniciales son:

1. **`Lineas` (Líneas de Taxis):**
   - Agrupa la configuración y los datos generales de cada empresa o corporación de taxis afiliada al ecosistema.
   - Permite relacionar de dónde proviene un viaje, y a qué línea pertenece cada operador o unidad de manejo registrada en el sistema.

2. **`Unidades` (Vehículos):**
   - Almacena el inventario de los vehículos pertenecientes a cada línea u operadora (placas, marca, modelo, estado actual/disponibilidad).
   - Estrechamente relacionadas con la línea a la que pertenecen y los actores (conductores) que las manejan para las carreras.

3. **`Conductores`:**
   - Información del personal o choferes asociados a las unidades. 
   - Contiene sus datos de contacto y estatus de disponibilidad para la asignación de viajes de parte de sus respectivos operadores de Base.

4. **`Operadores` (Usuarios del Sistema Web):**
   - Los recepcionistas encargados de la atención al cliente constante utilizando la plataforma **Taximast Web**.
   - Manejan sus propias credenciales de login, estado actual (Ej. "Turno abierto", "En línea", "Ocupado") y niveles de permisos o roles.

5. **`Mensajes` (Chats de WhatsApp):**
   - La colección núcleo del flujo de mensajería asincrónica o en tiempo real. 
   - Almacena cada interacción (mensaje entrante del cliente o enviado por el operador) consumida por la API oficial de WhatsApp.
   - Incluye referencias vitales para trazabilidad: el Cliente emisor/receptor (número, perfil web), el Operador que brindó la atención, timestamps (fecha/hora de envío y recepción) y estado del mensaje según los webhooks de Meta (enviado, entregado, leído).

---

## ⚙️ Desarrollo y Ejecución Local

Para instalar y correr este proyecto de forma local:

1. Clonar el repositorio del proyecto.
2. Instalar las dependencias de **Node.js**:
   ```bash
   npm install
   ```
3. Configurar todas las variables de entorno (`.env`) requeridas por el sistema, tales como credenciales de **MongoDB**, y los secret tokens / keys / Phone ID provistos por el Dashboard de **Meta for Developers** (WhatsApp Business API).
4. Iniciar el entorno de desarrollo usando el compilador rápido de Next.js (`Turbopack`):
   ```bash
   npm run dev
   ```

El servidor estará corriendo de manera predeterminada en `http://localhost:3000`.

---
📝 *Este archivo proporciona las bases arquitectónicas y los contextos iniciales del sistema. Se recomienda mantenerlo actualizado a medida que se maduren nuevos módulos funcionales o esquemas de la BD en Mongoose.*
