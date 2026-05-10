Plan de Implementación: Arquitectura Omnicanal (WhatsApp + Telegram MTProto)

Proyecto: Taximast Web
Objetivo: Permitir que la entidad Lineas posea credenciales tanto de WhatsApp como de Telegram. El servidor server.mjs debe gestionar ambas conexiones simultáneamente y discriminar los chats mediante una propiedad platform en la base de datos y WebSockets.

📋 PRE-REQUISITOS: Actualización del Esquema (Base de Datos)

Antes de tocar el servidor, el Agente debe actualizar los modelos en PocketBase (o la BD en uso) y sus interfaces TypeScript (types/index.ts o models/Lineas.ts, models/Chats.ts):

Colección Lineas:

Añadir campos: telegram_api_id (Number), telegram_api_hash (String), telegram_session (String).

Colección Chats / Messages:

Añadir campo: platform (String: opciones 'whatsapp' | 'telegram').

Nota: Esto permitirá al frontend (ChatPageClient.tsx) renderizar pestañas separadas o íconos distintivos por chat.

⚙️ FASE 3 (Actualizada): Gestor Dinámico en server.mjs

En lugar de un solo cliente, crearemos un Map para almacenar múltiples instancias de Telegram (una por cada Línea que tenga credenciales).

Instrucción para el Agente: Reemplazar la inicialización estática en server.mjs por este gestor dinámico.

// En server.mjs (Sección de inicialización)
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import pb from './lib/pocketbase.js'; // Ajustar ruta al cliente de BD

// Almacén de clientes activos: { lineaId: TelegramClient }
global.telegramClients = new Map();

async function initTelegramClients() {
    try {
        // 1. Buscar todas las líneas que tengan credenciales de Telegram
        const lineas = await pb.collection('lineas').getFullList({
            filter: 'telegram_session != "" && telegram_api_id != null'
        });

        for (const linea of lineas) {
            const session = new StringSession(linea.telegram_session);
            const client = new TelegramClient(session, parseInt(linea.telegram_api_id), linea.telegram_api_hash, {
                connectionRetries: 5,
            });

            await client.connect();
            console.log(`✅ Telegram conectado para la línea: ${linea.nombre}`);
            
            // Guardar en el Map para usarlo en rutas de envío (Outbound)
            global.telegramClients.set(linea.id, client);

            // Iniciar escucha de mensajes para ESTA línea (Llama a Fase 5)
            setupTelegramInbound(client, linea);
        }
    } catch (error) {
        console.error("❌ Error inicializando clientes de Telegram:", error);
    }
}

// Ejecutar al arrancar el servidor
initTelegramClients();


🔌 FASE 4 (Actualizada): Endpoint de Envío Unificado (Outbound)

Instrucción para el Agente: Crear o modificar la ruta de envío para que acepte el parámetro platform y decida qué motor usar.

// En server.mjs
server.post('/api/dispatch/unified', express.json(), async (req, res) => {
    const { lineaId, phone, message, platform } = req.body; // platform: 'whatsapp' | 'telegram'

    try {
        if (platform === 'telegram') {
            const tgClient = global.telegramClients.get(lineaId);
            if (!tgClient) throw new Error("Cliente de Telegram no activo para esta línea.");
            
            // Normalizar número (+58...)
            const normalizedPhone = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, '');
            await tgClient.sendMessage(normalizedPhone, { message: message });
            
        } else if (platform === 'whatsapp') {
            // Lógica existente de WhatsApp (axios a Meta Graph API)
            // await sendWhatsAppMessage(lineaId, phone, message);
        } else {
            throw new Error("Plataforma no soportada");
        }

        res.status(200).json({ success: true, platform });
    } catch (error) {
        console.error(`[Dispatch Error - ${platform}]:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});


🤖 FASE 5 (Reescrita): Discriminación de Chats Inbound e IA

Esta es la lógica central. Cuando entra un mensaje por Telegram, se debe guardar en la base de datos etiquetado con platform: 'telegram', y se debe emitir por WebSockets con esa misma etiqueta.

Instrucción para el Agente: Implementar la función setupTelegramInbound en server.mjs.

// En server.mjs
function setupTelegramInbound(tgClient, lineaData) {
    tgClient.addEventHandler(async (event) => {
        const message = event.message;

        // Ignorar mensajes salientes para evitar bucles
        if (message.out) return;

        try {
            const senderId = message.peerId?.userId?.toString();
            const text = message.text;
            const sender = await message.getSender();
            const phone = sender?.phone ? `+${sender.phone}` : senderId; // Fallback al ID si oculta el número

            console.log(`[IN - TELEGRAM - Línea ${lineaData.nombre}] De: ${phone} | Text: ${text}`);

            // 1. Guardar en Base de Datos discriminando la plataforma
            // Asegurarse de buscar o crear el chat con platform = 'telegram'
            /* const chatRecord = await findOrCreateChat({
                linea_id: lineaData.id,
                phone: phone,
                platform: 'telegram' // <-- DATO CLAVE DE DISCRIMINACIÓN
            });
            await saveMessageInDB(chatRecord.id, text, 'inbound');
            */

            // 2. Emitir evento por Socket.io al Frontend (DashboardClient / ChatPageClient)
            io.emit('new_message', {
                lineaId: lineaData.id,
                platform: 'telegram', // <-- El Frontend usa esto para poner el logo de TG y separar listas
                chatInfo: {
                    phone: phone,
                    name: sender?.firstName || "Usuario TG"
                },
                text: text,
                timestamp: new Date()
            });

            // 3. Integración con Agente de IA (Opcional por línea)
            // if (lineaData.ai_enabled) {
            //    const aiResponse = await processWithGemini(text, 'telegram', lineaData);
            //    await tgClient.sendMessage(senderId, { message: aiResponse });
            //    
            //    // Emitir respuesta de IA
            //    io.emit('new_message', {
            //        lineaId: lineaData.id,
            //        platform: 'telegram',
            //        chatInfo: { phone: lineaData.telefono, name: 'IA Bot' },
            //        text: aiResponse,
            //        timestamp: new Date()
            //    });
            // }

        } catch (err) {
            console.error("[Telegram Inbound Error]:", err);
        }
    }, new NewMessage({}));
}


🖥️ FASE 6: Requisitos para el Frontend (Dashboard de React)

Instrucción para el Agente: Modificar los componentes del cliente (ChatPageClient.tsx y DashboardClient.tsx) para consumir la nueva estructura:

Interfaz de Pestañas/Filtros: Añadir un Toggle o Tabs en la lista de chats para filtrar por platform === 'whatsapp' o platform === 'telegram'.

Renderizado de Íconos: En el componente de la lista de chats (ChatList), añadir una validación:

{chat.platform === 'telegram' ? <TelegramIcon className="text-blue-500" /> : <WhatsAppIcon className="text-green-500" />}


Envío desde UI: Al enviar un mensaje manual desde el panel, el payload enviado a la API de tu backend debe incluir explícitamente el chat.platform para que el endpoint unificado de la Fase 4 sepa qué motor disparar.