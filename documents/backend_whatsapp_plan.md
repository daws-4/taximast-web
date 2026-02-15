# Backend WhatsApp API — Plan de Implementación (Next.js)

## Descripción

Backend REST API que actúa como intermediario entre TAXIMAST (Visual FoxPro) y la API oficial de WhatsApp Business (Meta Cloud API). Recibe peticiones HTTP de VFP y las traduce a llamadas de la API de Meta.

---

## Endpoints a implementar

### 1. `GET /api/whatsapp/status`

Verifica que el backend y la conexión con WhatsApp estén activos.

**Response (200):**
```json
{ "connected": true, "service": "whatsapp-business-api" }
```

**Lógica:**
- Verificar que el token de Meta es válido
- Opcionalmente hacer un health check a `https://graph.facebook.com`

---

### 2. `POST /api/whatsapp/send`

Envía un mensaje individual (texto + imagen opcional).

**Request body:**
```json
{
  "phone": "04121234567",
  "message": "CLIENTE: Juan Perez Av. Libertador...",
  "type": "dispatch_driver",
  "image": "D:\\TAXIMAST\\IDENTIFICADORES\\CHOFER01.PNG"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `phone` | string | ✅ | Teléfono destino |
| `message` | string | ✅ | Texto del mensaje |
| `type` | string | ✅ | `dispatch_driver`, `dispatch_client`, `broadcast_clients`, `broadcast_partners` |
| `image` | string | ❌ | Ruta local de imagen (identificador del chofer) |

**Lógica:**
1. Si `image` está presente:
   - Leer el archivo de la ruta local (si el backend corre en la misma red/máquina)
   - O configurar una carpeta compartida / URL accesible
   - Subir la imagen a Meta usando **Media API**: `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/media`
   - Enviar mensaje con imagen usando el `media_id` obtenido
2. Si no hay imagen:
   - Enviar mensaje de texto simple via Meta API
3. Llamada a Meta API para envío de texto:
```
POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "{phone}",
  "type": "text",
  "text": { "body": "{message}" }
}
```

4. Llamada a Meta API para envío con imagen:
```
POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
{
  "messaging_product": "whatsapp",
  "to": "{phone}",
  "type": "image",
  "image": {
    "id": "{media_id}",
    "caption": "{message}"
  }
}
```

**Response (200):**
```json
{ "success": true, "messageId": "wamid.HBgLNTg..." }
```

**Response (error):**
```json
{ "success": false, "error": "Descripción del error" }
```

---

### 3. `POST /api/whatsapp/send-bulk`

Envía mensajes a múltiples destinatarios.

**Request body:**
```json
{
  "messages": [
    { "phone": "04121234567", "message": "LE SALUDA Maria..." },
    { "phone": "04129876543", "message": "LE SALUDA Maria..." }
  ],
  "type": "broadcast_partners"
}
```

**Lógica:**
- Iterar sobre el array `messages`
- Enviar cada uno con la Meta API (respetar rate limits: ~80 mensajes/segundo para Business API)
- Contar éxitos y fallos

**Response (200):**
```json
{ "success": true, "sent": 15, "failed": 0 }
```

---

### 4. `GET /api/whatsapp/location?phone={phone}`

Retorna la última ubicación compartida por un cliente vía WhatsApp.

**Lógica:**
- Buscar en base de datos la última ubicación almacenada para ese teléfono
- Las ubicaciones se almacenan cuando llegan al webhook (ver endpoint 5)

**Response (con ubicación):**
```json
{
  "found": true,
  "latitude": 10.4806,
  "longitude": -66.9036,
  "maps_url": "https://maps.google.com/?q=10.4806,-66.9036",
  "timestamp": "2026-02-15T10:30:00Z"
}
```

**Response (sin ubicación):**
```json
{ "found": false }
```

---

### 5. `POST /api/whatsapp/webhook`

Recibe eventos de WhatsApp (mensajes entrantes, estados de entrega). Configurar en Meta → App Dashboard → Webhooks.

**Verificación del webhook (GET):**
Meta envía un GET para verificar:
```
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token={TOKEN}&hub.challenge={CHALLENGE}
```
Responder con el valor de `hub.challenge` si el `verify_token` coincide.

**Mensajes entrantes (POST):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "584121234567",
          "type": "location",
          "location": {
            "latitude": 10.4806,
            "longitude": -66.9036,
            "name": "Mi ubicación",
            "address": "Av. Libertador"
          }
        }]
      }
    }]
  }]
}
```

**Lógica:**
- Si `type === "location"` → Guardar en DB: `{ phone, latitude, longitude, timestamp }`
- Otros tipos de mensajes: almacenar o ignorar según necesidad

---

## Variables de entorno necesarias

```env
# Meta WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_VERIFY_TOKEN=mi-token-secreto

# Base de datos (para almacenar ubicaciones)
DATABASE_URL=mongodb://... o postgres://...

# Ruta compartida de imágenes (si el backend no corre en la misma máquina que TAXIMAST)
IMAGES_BASE_PATH=\\\\servidor\\TAXIMAST\\IDENTIFICADORES
# O bien una URL de acceso:
# IMAGES_BASE_URL=https://mi-servidor.com/identificadores
```

---

## Tipos de mensaje que envía VFP

| `type` | Origen en VFP | Destino | Incluye imagen |
|---|---|---|---|
| `dispatch_driver` | `servicios.SCT` | Chofer | ❌ |
| `dispatch_client` | `servicios.SCT` | Cliente | ✅ Foto identificador |
| `broadcast_clients` | `mensaje.SCT` botones 1 y 2 | Clientes del día | ❌ |
| `broadcast_partners` | `mensaje.SCT` botón 3 | Socios activos | ❌ |

---

## Modelo de datos (ubicaciones)

```typescript
interface WhatsAppLocation {
  phone: string;       // "584121234567"
  latitude: number;    // 10.4806
  longitude: number;   // -66.9036
  name?: string;       // "Mi ubicación"
  address?: string;    // "Av. Libertador"
  timestamp: Date;     // Fecha/hora de recepción
}
```

---

## Notas sobre la imagen del identificador

La ruta que envía VFP es local (ej: `D:\TAXIMAST\IDENTIFICADORES\CHOFER01.PNG`). Opciones para manejarla:

1. **Backend en la misma máquina/red:** Leer directamente del path
2. **Backend remoto:** Configurar carpeta compartida o servicio de archivos
3. **Alternativa:** Modificar VFP para convertir la imagen a Base64 y enviarla en el JSON (requiere más cambios en `whatsapp_http.prg`)
