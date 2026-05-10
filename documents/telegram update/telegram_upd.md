Plan de Implementación: Telegram Userbot (MTProto) en Next.js

Proyecto: Taximast Web
Objetivo: Reemplazar/Alternar WhatsApp Cloud API con Telegram Client API (GramJS) mediante un Userbot, manteniendo la compatibilidad con Visual FoxPro (VFP), Socket.io y Google Gemini.

📋 Contexto para el Agente de IA Ejecutor

Arquitectura actual: Aplicación Next.js 14 con un servidor personalizado en Express (server.mjs) que ya maneja Socket.io.

Restricción de Estado: GramJS requiere una conexión persistente (TCP). NO debe implementarse dentro de las rutas serverless de Next.js (app/api/...). Toda la lógica de conexión y endpoints REST para FoxPro deben residir en server.mjs.

Dependencias a instalar: telegram (GramJS) e input (para la autenticación por consola).

🚀 FASE 1: Preparación y Credenciales

Paso 1.1: Obtener Credenciales de Telegram

Ingresar a https://my.telegram.org con el número telefónico objetivo (ej. el número de Taximast).

Ir a "API development tools".

Crear una app (los nombres no importan) para obtener el App api_id y App api_hash.

Paso 1.2: Instalación de Dependencias
Ejecutar en la terminal del proyecto:

npm install telegram input


Paso 1.3: Variables de Entorno
Añadir al archivo .env del proyecto:

TG_API_ID=tu_api_id_aqui
TG_API_HASH=tu_api_hash_aqui
TG_SESSION_STRING=


(Dejar TG_SESSION_STRING vacío por ahora, se generará en la Fase 2).

🔑 FASE 2: Script de Autenticación Independiente

Racionalidad: No podemos autenticar interactivamente (pidiendo códigos por consola) cada vez que el servidor server.mjs se reinicia. Necesitamos generar una "Cadena de Sesión" (String Session) una sola vez.

Paso 2.1: Crear archivo de autenticación
Crear el archivo scripts/tg_auth.mjs en la raíz del proyecto:

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import dotenv from "dotenv";

dotenv.config();

const apiId = parseInt(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(""); // Vacío porque vamos a crearlo

(async () => {
  console.log("Iniciando autenticación de Telegram...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Ingresa el número telefónico (ej. +58414...): "),
    password: async () => await input.text("Ingresa tu contraseña de verificación en 2 pasos (si tienes): "),
    phoneCode: async () => await input.text("Ingresa el código que recibiste en Telegram: "),
    onError: (err) => console.log(err),
  });

  console.log("¡Autenticación exitosa!");
  console.log("Copia la siguiente cadena y pégala en tu archivo .env en TG_SESSION_STRING:");
  console.log("-----------------------------------");
  console.log(client.session.save());
  console.log("-----------------------------------");
  process.exit(0);
})();


Paso 2.2: Ejecutar y Guardar
Ejecutar node scripts/tg_auth.mjs, seguir las instrucciones y pegar la cadena resultante en el .env (TG_SESSION_STRING=1ApWapz...).

⚙️ FASE 3: Integración Core en server.mjs

Paso 3.1: Importar y Configurar GramJS
Abrir server.mjs y añadir en la cabecera:

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
// Importar Gemini (ajustar ruta según exportaciones de lib/gemini.ts)
// import { generateResponse } from './lib/gemini.ts'; 


Paso 3.2: Inicializar Cliente de Telegram
Dentro de server.mjs, justo antes de server.all('*', ...) y después de inicializar Socket.io, agregar:

// --- CONFIGURACIÓN TELEGRAM USERBOT ---
const tgSession = new StringSession(process.env.TG_SESSION_STRING || "");
const tgApiId = parseInt(process.env.TG_API_ID);
const tgApiHash = process.env.TG_API_HASH;

let tgClient = null;

if (process.env.TG_SESSION_STRING) {
    tgClient = new TelegramClient(tgSession, tgApiId, tgApiHash, {
        connectionRetries: 5,
    });
    
    // Conectar en segundo plano
    tgClient.connect().then(() => {
        console.log("✅ Telegram Userbot conectado exitosamente.");
    }).catch(console.error);
}


🔌 FASE 4: Endpoint REST para Visual FoxPro (VFP)

Añadir este endpoint en server.mjs (antes del manejador catch-all de Next.js) para que VFP pueda hacer POST y enviar mensajes mediante Telegram:

// --- ENDPOINT PARA VISUAL FOXPRO -> TELEGRAM ---
server.post('/api/telegram/dispatch', express.json(), async (req, res) => {
    if (!tgClient || !tgClient.connected) {
        return res.status(500).json({ success: false, error: "Telegram client not connected" });
    }

    try {
        let { phone, message } = req.body;
        
        // Normalización básica del teléfono: Asegurar que tenga '+' y el código de país (ej. +58)
        // Adaptar esta lógica según cómo guarde los números Taximast
        if (!phone.startsWith('+')) {
            phone = '+' + phone.replace(/\D/g, ''); // Limpiar caracteres raros y añadir +
        }

        await tgClient.sendMessage(phone, { message: message });
        
        console.log(`[Telegram] Mensaje enviado a ${phone}`);
        res.status(200).json({ success: true, message: "Enviado por Telegram" });
    } catch (error) {
        console.error("[Telegram Error al enviar]:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


Instrucción Externa: En whatsapp_http.prg (VFP), cambiar la constante #DEFINE WA_BASE_URL a https://taximast.enlaredve.com/api/telegram.

🤖 FASE 5: Recepción (Inbound), IA y WebSockets

En server.mjs, debajo de la conexión de tgClient, configurar el escuchador de eventos para procesar mensajes entrantes de clientes, pasarlos a Gemini y emitirlos al Dashboard:

// --- MANEJADOR DE MENSAJES ENTRANTES (INBOUND) ---
if (tgClient) {
    tgClient.addEventHandler(async (event) => {
        const message = event.message;

        // IGNORAR mensajes salientes (enviados por el bot o desde el móvil)
        if (message.out) return;

        // Extraer datos útiles
        const senderId = message.peerId?.userId?.toString(); // ID de Telegram
        const text = message.text;
        const sender = await message.getSender();
        const phone = sender?.phone ? `+${sender.phone}` : "Desconocido";

        console.log(`[Telegram IN] Mensaje de ${phone}: ${text}`);

        // 1. Emitir evento por Socket.io hacia el Dashboard Web de Taximast
        io.emit('new_message', {
            platform: 'telegram',
            phone: phone,
            text: text,
            timestamp: new Date()
        });

        // 2. Integración con Gemini IA (Agente Automático)
        // NOTA PARA EL AGENTE: Descomentar e integrar la función real de lib/gemini.ts
        /*
        try {
            const aiResponse = await generateResponse(text); // Tu función de Gemini
            
            // Enviar respuesta generada por IA
            await tgClient.sendMessage(senderId, { message: aiResponse });
            
            // Emitir la respuesta de la IA al Dashboard
            io.emit('new_message', {
                platform: 'telegram',
                phone: 'Taximast (IA)',
                text: aiResponse,
                timestamp: new Date()
            });
        } catch (aiError) {
            console.error("Error en Gemini AI:", aiError);
        }
        */

    }, new NewMessage({}));
}


🧪 FASE 6: Protocolo de Pruebas (Checklist)

Para validar que la implementación ha sido un éxito, el Agente y/o el Desarrollador deben verificar lo siguiente:

[ ] Prueba de Autenticación: Se ejecutó scripts/tg_auth.mjs y se guardó exitosamente el TG_SESSION_STRING en .env.

[ ] Prueba de Arranque: Al ejecutar npm run dev (o iniciar el servidor Node), la consola muestra "✅ Telegram Userbot conectado exitosamente." sin crashear Next.js.

[ ] Prueba de Envío (VFP / Outbound): Hacer una petición POST a http://localhost:3000/api/telegram/dispatch con un JSON {"phone": "+58414...", "message": "Prueba de envío"} y verificar que el mensaje llega al teléfono destino.

[ ] Prueba de Recepción (Inbound): Enviar un mensaje desde un número personal hacia el número de Taximast. La consola del servidor debe registrar [Telegram IN] Mensaje de....

[ ] Prueba IA y Sockets: Verificar que el Dashboard web reaccione al Socket y que Gemini responda en la app de Telegram del cliente.