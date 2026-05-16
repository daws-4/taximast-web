// server.mjs — Custom HTTP server para Next.js + Socket.io
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0"; // Cambiado a 0.0.0.0 para Docker
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function parseJSON(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error("Invalid JSON")); }
        });
    });
}

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        // Log de depuración para rastrear ruteo
        if (!req.url.startsWith('/_next') && !req.url.includes('/static')) {
            console.log(`[HTTP] ${req.method} ${req.url}`);
        }

        // ── Ruta interna: Motor de envío Telegram ───────────────────────
        if (req.method === "POST" && req.url === "/internal/telegram/send") {
            try {
                const body = await parseJSON(req);
                const { line_id, phone, message, mediaUrl, type } = body;
                const isDriver = type === 'dispatch_driver';

                const tgClient = global.telegramClients?.get(line_id);
                const availableClients = Array.from(global.telegramClients?.keys() || []);
                console.log(`[internal/telegram/send] line_id=${line_id} clientFound=${!!tgClient} connected=${tgClient?.connected} availableCount=${availableClients.length}`);
                
                if (!tgClient || !tgClient.connected) {
                    if (tgClient && !tgClient.connected) {
                        console.warn(`[internal/telegram/send] El cliente existe pero está DESCONECTADO para la línea ${line_id}. Intentando recarga...`);
                        reloadTelegramClient(line_id);
                    } else if (!tgClient) {
                        console.warn(`[internal/telegram/send] Cliente no encontrado para ${line_id}. Intentando inicializar...`);
                        reloadTelegramClient(line_id);
                    }
                    
                    const lastError = global.telegramErrors?.get(line_id) || (tgClient ? "Cliente existe pero no está conectado" : "Cliente no encontrado en el mapa global");
                    console.warn(`[internal/telegram/send] Error para ${line_id}: ${lastError}. Clientes disponibles: ${availableClients.join(', ')}`);
                    
                    res.writeHead(500, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        error: `Cliente Telegram inactivo para esta línea. Detalle: ${lastError}` 
                    }));
                }
                
                const isPotentialPhone = (phone.length >= 10 && (phone.startsWith("58") || phone.startsWith("0") || phone.startsWith("+")));
                let normalizedTarget;

                if (isPotentialPhone) {
                    normalizedTarget = phone.startsWith("+") ? phone : "+" + phone.replace(/\D/g, "");
                } else {
                    // Probablemente es un UserID (string de dígitos)
                    normalizedTarget = phone.replace(/\D/g, "");
                }
                
                // ── SEGURIDAD ANTI-SPAM ──────────────────────────────────────
                let targetPeer = null;
                try {
                    // 1. Intentar obtener la entidad (esto verifica si Telegram ya "conoce" la relación)
                    // Si es un ID, gramjs lo acepta como string o BigInt. Si es un teléfono, requiere el '+'
                    targetPeer = await tgClient.getEntity(normalizedTarget);
                } catch (e) {
                    console.log(`[OUT - TG] Usuario no conocido por Telegram (${normalizedTarget}). Intentando importar contacto si es teléfono...`);
                    
                    if (isPotentialPhone) {
                        const phoneToImport = normalizedTarget;
                        
                        try {
                            // Primero intentamos importar con datos mínimos para que Telegram resuelva el usuario.
                            // Si el número tiene Telegram, la respuesta traerá el nombre real del usuario.
                            // No usamos "Cliente Taximast" para no contaminar la libreta de contactos.
                            const result = await tgClient.invoke(
                                new Api.contacts.ImportContacts({
                                    contacts: [
                                        new Api.InputPhoneContact({
                                            clientId: BigInt(Date.now()),
                                            phone: phoneToImport,
                                            firstName: phoneToImport, // Placeholder mínimo, Telegram lo reemplaza con el nombre real
                                            lastName: ""
                                        })
                                    ]
                                })
                            );
                            
                            if (result.users && result.users.length > 0) {
                                targetPeer = result.users[0];
                                // Usar el nombre real que tiene Telegram para este usuario
                                const realName = [targetPeer.firstName, targetPeer.lastName].filter(Boolean).join(" ").trim();
                                console.log(`[OUT - TG] Contacto resuelto para ${phoneToImport}: nombre="${realName || phoneToImport}"`);
                            }
                        } catch (importErr) {
                            console.error(`[OUT - TG] Error crítico al importar contacto: ${importErr.message}`);
                        }
                    }
                }

                // ── SEGURIDAD ANTI-SPAM ──────────────────────────────────────
                // Si no se pudo resolver el peer, bloqueamos el envío para proteger la cuenta.
                // EXCEPCIÓN: Los chóferes (dispatch_driver) se envían directamente por teléfono/ID sin validación.
                if (!targetPeer && !isDriver) {
                    console.warn(`[OUT - TG] Bloqueado: No se pudo resolver peer para ${normalizedTarget}. El número puede no tener Telegram.`);
                    res.writeHead(403, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ 
                        success: false, 
                        error: "No se puede enviar por Telegram: el número no tiene cuenta de Telegram o no es un contacto conocido." 
                    }));
                }

                // Si es driver y no tenemos peer, usamos el target normalizado directamente
                const finalTarget = targetPeer || normalizedTarget;

                console.log(`[OUT - TG] Enviando a: ${normalizedTarget} | Mensaje: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`);
                
                if (mediaUrl) {
                    try {
                        console.log(`[OUT - TG] Intentando enviar archivo: ${mediaUrl}`);
                        await tgClient.sendFile(finalTarget, { 
                            file: mediaUrl, 
                            caption: message,
                            workers: 1
                        });
                        console.log(`[OUT - TG] Media enviado exitosamente a ${normalizedTarget}`);
                    } catch (sendErr) {
                        console.error(`[OUT - TG] Fallo al enviar media: ${sendErr.message}. Reintentando como texto...`);
                        await tgClient.sendMessage(finalTarget, { message });
                    }
                } else {
                    await tgClient.sendMessage(finalTarget, { message });
                    console.log(`[OUT - TG] Mensaje de texto enviado exitosamente a ${normalizedTarget}`);
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error("[Telegram OUT Error]:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: false, error: error.message }));
            }
        }

        // ── Ruta interna: Recarga de cliente Telegram ────────────────────
        if (req.method === "POST" && req.url === "/internal/telegram/reload") {
            try {
                const body = await parseJSON(req);
                const { line_id } = body;
                if (!line_id) throw new Error("Falta line_id");

                // Ejecutar en segundo plano para no bloquear el HTTP
                reloadTelegramClient(line_id);

                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: true, message: "Recarga iniciada" }));
            } catch (error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: false, error: error.message }));
            }
        }

        // ── Handler por defecto: Next.js ──────────────────────────────
        handle(req, res);
    });

    const io = new Server(httpServer, {
        path: "/api/socketio",
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // Exponer io globalmente para que las API routes puedan emitir eventos
    global.io = io;

    // ── TELEGRAM: Almacén de clientes activos ─────────────────────────
    global.telegramClients = new Map();
    global.telegramErrors = new Map();

    async function reloadTelegramClient(lineId) {
        try {
            console.log(`[Telegram] Recargando cliente para línea: ${lineId}`);
            
            // 1. Limpiar cliente anterior si existe
            const existingClient = global.telegramClients.get(lineId);
            if (existingClient) {
                try { await existingClient.disconnect(); } catch (e) {}
                global.telegramClients.delete(lineId);
            }
            global.telegramErrors.delete(lineId);

            // 2. Buscar datos de la línea
            const Lineas = mongoose.model("Lineas");
            const linea = await Lineas.findById(lineId).select("+telegram_api_id +telegram_api_hash +telegram_session +gemini_api_key +gemini_prompt");
            
            if (!linea || !linea.activa || !linea.telegram_session || !linea.telegram_api_id) {
                const reasons = [];
                if (!linea) reasons.push("Línea no encontrada");
                else {
                    if (!linea.activa) reasons.push("inactiva");
                    if (!linea.telegram_session) reasons.push("falta telegram_session");
                    if (!linea.telegram_api_id) reasons.push("falta telegram_api_id");
                }
                console.log(`[Telegram] Línea ${lineId} no elegible para Telegram. Motivos: ${reasons.join(", ")}`);
                return;
            }

            // 3. Crear y conectar nuevo cliente
            const session = new StringSession(linea.telegram_session);
            const client = new TelegramClient(
                session,
                parseInt(linea.telegram_api_id),
                linea.telegram_api_hash,
                { connectionRetries: 5 }
            );

            await client.connect();
            console.log(`✅ [Telegram] Conectado exitosamente para línea: ${linea.name} (${lineId})`);

            client.addEventHandler((event) => {
                // Log simple para ver que el cliente sigue vivo al recibir eventos de sistema
            });

            // Manejar desconexión inesperada con re-intento automático
            client.on("disconnected", () => {
                console.warn(`⚠️ [Telegram] Cliente desconectado para línea: ${linea.name} (${lineId}). Reintentando conexión en 10 segundos...`);
                global.telegramErrors.set(lineId, "Cliente desconectado (reintentando...)");
                
                // Evitar múltiples re-intentos simultáneos
                if (client._reconnecting) return;
                client._reconnecting = true;
                
                setTimeout(() => {
                    if (global.telegramClients.get(lineId) === client) {
                        reloadTelegramClient(lineId);
                    }
                }, 10000);
            });

            global.telegramClients.set(lineId, client);
            setupTelegramInbound(client, linea, global.io);
        } catch (err) {
            let detail = err.message;
            if (err.message.includes("AUTH_KEY_DUPLICATED")) {
                detail = "SESIÓN DUPLICADA: Esta línea ya está conectada desde otro lugar o proceso. Revisa que no tengas otra ventana de terminal abierta.";
            }
            console.error(`❌ [Telegram] Error conectando línea ${lineId}:`, detail);
            global.telegramErrors.set(lineId, detail);
        }
    }

    async function initTelegramClients() {
        try {
            const MONGODB_URI = process.env.MONGODB_URI;
            if (!MONGODB_URI) {
                console.warn("[telegram] MONGODB_URI no definido, omitiendo Telegram.");
                return;
            }

            if (mongoose.connection.readyState !== 1) {
                await mongoose.connect(MONGODB_URI, { bufferCommands: true });
            }

            // Registrar esquemas dinámicos para que Node.js no falle al no poder importar TS
            // ⚠️ Los campos con select:false DEBEN declararse en el schema aquí o el operador + no funciona
            if (!mongoose.models.Lineas) {
                mongoose.model("Lineas", new mongoose.Schema({
                    name: String,
                    activa: Boolean,
                    plataforma_despacho: String,
                    telegram_phone: String,
                    ia_activa: { type: Boolean, default: true },
                    telegram_api_id: { type: Number, select: false },
                    telegram_api_hash: { type: String, select: false },
                    telegram_session: { type: String, select: false },
                    gemini_api_key: { type: String, select: false },
                    gemini_prompt: { type: String, select: false },
                    auto_reply_activo: { type: Boolean, default: false },
                    auto_reply_mensaje: { type: String, select: false },
                }, { strict: false }));
            }
            if (!mongoose.models.Chats) {
                mongoose.model("Chats", new mongoose.Schema({}, { strict: false }));
            }
            if (!mongoose.models.Conductores) {
                mongoose.model("Conductores", new mongoose.Schema({}, { strict: false }));
            }

            const Lineas = mongoose.model("Lineas");
            const lineas = await Lineas.find({
                activa: true,
                telegram_session: { $exists: true, $ne: "" },
                telegram_api_id: { $exists: true, $ne: null },
            }).select("+telegram_api_id +telegram_api_hash +telegram_session +gemini_api_key +gemini_prompt");

            console.log(`[Telegram] Se encontraron ${lineas.length} líneas configuradas para Telegram.`);
            for (const linea of lineas) {
                console.log(`[Telegram] Iniciando cliente para línea: ${linea.name} (${linea._id})`);
                await reloadTelegramClient(linea._id.toString());
            }

            if (lineas.length === 0) {
                console.log("[Telegram] No hay líneas con credenciales configuradas.");
            }

            // Log de diagnóstico final
            const todasLasLineas = await Lineas.find({ activa: true });
            console.log(`[Telegram Init] Resumen: ${lineas.length} inicializadas de ${todasLasLineas.length} activas en total.`);
            if (lineas.length < todasLasLineas.length) {
                const initIds = lineas.map(l => l._id.toString());
                const missing = todasLasLineas.filter(l => !initIds.includes(l._id.toString()));
                console.log(`[Telegram Init] Líneas activas SIN Telegram config: ${missing.map(l => `${l.name} (${l._id})`).join(", ")}`);
            }
        } catch (error) {
            console.error("❌ [Telegram] Error inicializando clientes:", error);
        }
    }

    // Reducir el delay de inicio a 1 segundo para ser más responsivo en reinicios
    setTimeout(() => initTelegramClients(), 1000);

    // Watchdog: Cada 30 minutos verifica si hay clientes caídos que deberían estar activos
    setInterval(async () => {
        console.log("[Telegram Watchdog] Verificando salud de las conexiones...");
        try {
            const Lineas = mongoose.model("Lineas");
            const lineasConfiguradas = await Lineas.find({
                activa: true,
                telegram_session: { $exists: true, $ne: "" },
            }).select("_id name");

            for (const l of lineasConfiguradas) {
                const id = l._id.toString();
                const client = global.telegramClients.get(id);
                
                if (!client || !client.connected) {
                    console.log(`[Telegram Watchdog] Re-inicializando línea caída: ${l.name} (${id})`);
                    reloadTelegramClient(id);
                }
            }
        } catch (err) {
            console.error("[Telegram Watchdog] Error:", err.message);
        }
    }, 30 * 60 * 1000); // 30 minutos

    io.on("connection", (socket) => {
        // Cliente se une a la sala de su línea (recibe todos los eventos de esa línea)
        socket.on("join:linea", (lineaId) => {
            if (lineaId) socket.join(`linea:${lineaId}`);
        });

        // Cliente se une a la sala de un chat específico (para mensajes en tiempo real)
        socket.on("join:chat", (chatId) => {
            if (chatId) socket.join(`chat:${chatId}`);
        });

        // Cliente abandona la sala de un chat (cuando cierra el panel)
        socket.on("leave:chat", (chatId) => {
            if (chatId) socket.leave(`chat:${chatId}`);
        });

        socket.on("disconnect", () => {
            // Socket.io limpia las salas automáticamente al desconectar
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
    });

    // ── CIERRE LIMPIO ───────────────────────────────────────────────
    const shutdown = async () => {
        console.log("\n[Server] Cerrando servidor...");
        
        // Desconectar clientes de Telegram
        if (global.telegramClients) {
            console.log("[Telegram] Desconectando clientes...");
            for (const [id, client] of global.telegramClients) {
                try { await client.disconnect(); } catch (e) {}
            }
        }

        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
});

// Helper: normaliza un teléfono quitando el '+' y espacios para consistencia E.164 puro
function normalizePhoneTG(phone) {
    if (!phone) return phone;
    return phone.replace(/\D/g, ""); // Quita todo excepto dígitos (incluye el '+')
}

// Helper: devuelve todas las variantes posibles de un teléfono (con y sin '+', con y sin código de país)
// para búsquedas en BD que puedan tener distintos formatos almacenados
function getPhoneVariantsTG(phone) {
    let p = phone.replace(/\D/g, ""); // Strip todo no-dígito
    let norm = p;
    if (p.startsWith("58")) norm = p.slice(2);
    else if (p.startsWith("0")) norm = p.slice(1);
    // Devuelve variantes: sin '+', con '+', con código de país, sin código de país, con 0 local
    return [p, norm, `0${norm}`, `58${norm}`, `+${p}`, `+58${norm}`];
}

function setupTelegramInbound(tgClient, lineaData, io) {
    tgClient.addEventHandler(async (event) => {
        const message = event.message;

        if (message.out) return; // Ignorar salientes

        try {
            const senderId = message.peerId?.userId?.toString();
            const text = message.text;
            if (!text || !senderId) return;

            const sender = await message.getSender();
            // Normalizar: quitar '+' y no-dígitos → E.164 puro (sin prefijo '+')
            const rawPhone = sender?.phone ? normalizePhoneTG(sender.phone) : null;
            // phone: si hay teléfono real lo usamos normalizado; si no, usamos el senderId numérico
            const phone = rawPhone || senderId;
            const senderName = sender?.firstName
                ? `${sender.firstName}${sender.lastName ? " " + sender.lastName : ""}`
                : "Usuario TG";

            console.log(`[IN - TG - ${lineaData.name}] De: ${phone} (UID: ${senderId}) | Texto: ${text}`);

            const lineaId = lineaData._id.toString();
            const Chats = mongoose.model("Chats");
            const Lineas = mongoose.model("Lineas");
            const Conductores = mongoose.model("Conductores");
            const now = new Date();

            // Buscar datos actualizados de la línea (por si cambiaron credenciales de IA o auto-reply)
            const lineaActual = await Lineas.findById(lineaId).select("+gemini_api_key +gemini_prompt +ia_activa +auto_reply_activo +auto_reply_mensaje");
            if (!lineaActual) return;

            const nuevoMensaje = {
                _id: new mongoose.Types.ObjectId(),
                origen: "cliente",
                texto: text,
                timestamp: now,
                leido: false,
                estado: "entregado",
                tipo: "text",
                tg_peer_id: senderId,
            };

            // Variantes del teléfono para búsqueda tolerante a formato (con y sin '+')
            const phoneVariants = rawPhone ? getPhoneVariantsTG(rawPhone) : [];

            // 1. Intentar buscar por tg_user_id (más fiable, no depende de formato de teléfono)
            let chat = await Chats.findOne({
                linea: lineaId,
                platform: "telegram",
                tg_user_id: senderId,
            });

            // Si lo encontramos por UID, asegurar que el teléfono esté normalizado (sin '+')
            if (chat && rawPhone) {
                const normalizedStored = normalizePhoneTG(chat.cliente_phone || "");
                if (normalizedStored !== rawPhone) {
                    console.log(`[TG-UPDATE] Normalizando/actualizando teléfono de chat ${chat._id}: "${chat.cliente_phone}" → "${rawPhone}"`);
                    chat.cliente_phone = rawPhone;
                }
            }

            // 2. Si no existe por UID, buscar por teléfono en todas sus variantes (con y sin '+')
            if (!chat && phoneVariants.length > 0) {
                chat = await Chats.findOne({
                    linea: lineaId,
                    platform: "telegram",
                    cliente_phone: { $in: phoneVariants },
                });

                // Si lo encontramos por teléfono, asignar UID y normalizar el teléfono almacenado
                if (chat) {
                    console.log(`[TG-MERGE] Chat encontrado por teléfono ("${chat.cliente_phone}") → asignando tg_user_id ${senderId} y normalizando`);
                    chat.tg_user_id = senderId;
                    chat.cliente_phone = rawPhone; // Guardar siempre en formato E.164 puro (sin '+')
                }
            }

            const conductorDoc = rawPhone
                ? await Conductores.findOne({
                    linea: lineaId,
                    telefono: { $in: getPhoneVariantsTG(phone) },
                    activo: true,
                })
                : null;

            let isNew = false;
            let wasReopened = false;

            if (!chat) {
                isNew = true;
                chat = await Chats.create({
                    linea: lineaId,
                    cliente_phone: phone,
                    cliente_nombre: senderName,
                    platform: "telegram",
                    tg_user_id: senderId,
                    estado: "pendiente",
                    tipo_chat: conductorDoc ? "conductor" : "cliente",
                    ...(conductorDoc ? { conductor: conductorDoc._id } : {}),
                    mensajes: [nuevoMensaje],
                    ultimoMensaje: now,
                });
            } else {
                if (chat.estado === "cerrado") {
                    chat.estado = "pendiente";
                    wasReopened = true;
                }
                chat.mensajes.push(nuevoMensaje);
                chat.ultimoMensaje = now;
                if (senderName && !chat.cliente_nombre) chat.cliente_nombre = senderName;
                await chat.save();
            }

            const chatId = chat._id.toString();

            // Si no hay IA configurada → mover directamente a esperando_operador
            if (!lineaData.gemini_api_key && (chat.estado === "pendiente" || wasReopened)) {
                chat.estado = "esperando_operador";
                await chat.save();
                if (io) {
                    io.to(`linea:${lineaId}`).to("linea:admin").emit("chat:estado_cambiado", {
                        chatId, 
                        estado: chat.estado,
                        cliente_nombre: chat.cliente_nombre
                    });
                }
            }

            if (io) {
                // Si es nuevo O fue reabierto, emitir como chat nuevo para que aparezca en el sidebar
                if (isNew || wasReopened) {
                    io.to(`linea:${lineaId}`).to("linea:admin").emit("chat:nuevo_chat", {
                        _id: chatId,
                        linea: { _id: lineaId, name: lineaData.name },
                        cliente_phone: phone,
                        cliente_nombre: senderName,
                        tipo_chat: chat.tipo_chat,
                        estado: chat.estado,
                        platform: "telegram",
                        ultimoMensaje: now.toISOString(),
                    });
                } else {
                    io.to(`chat:${chatId}`).emit("chat:nuevo_mensaje", {
                        chatId,
                        mensaje: {
                            _id: nuevoMensaje._id.toString(),
                            origen: "cliente",
                            texto: text,
                            timestamp: now.toISOString(),
                            leido: false,
                            tipo: "text",
                        },
                    });
                }

                io.to(`linea:${lineaId}`).to("linea:admin").emit("chat:nuevo_mensaje", {
                    chatId,
                    mensaje: {
                        _id: nuevoMensaje._id.toString(),
                        origen: "cliente",
                        texto: text,
                        timestamp: now.toISOString(),
                    },
                });
            }

            // ── LÓGICA DE RESPUESTA AUTOMÁTICA (AUTO-REPLY) ──────────────────
            let autoReplyEnviado = false;
            const puedeAutoReply = lineaActual.auto_reply_activo 
                && lineaActual.auto_reply_mensaje
                && chat.tipo_chat !== "conductor" 
                && chat.estado !== "en_atencion"
                && !chat.bloqueado;

            if (puedeAutoReply) {
                console.log(`[TG-AUTO] Enviando respuesta automática para línea ${lineaActual.name}...`);
                const replyText = lineaActual.auto_reply_mensaje;
                const destPhone = chat.cliente_phone;
                const baseUrl = `http://127.0.0.1:${port}`;

                try {
                    const tgRes = await fetch(`${baseUrl}/internal/telegram/send`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            line_id: lineaId,
                            phone: destPhone,
                            message: replyText,
                        }),
                    });

                    if (tgRes.ok) {
                        autoReplyEnviado = true;
                        const aiMessage = {
                            _id: new mongoose.Types.ObjectId(),
                            origen: 'sistema',
                            texto: replyText,
                            timestamp: new Date(),
                            leido: true,
                            estado: 'enviado',
                            tipo: 'text',
                        };

                        chat.mensajes.push(aiMessage);
                        chat.ultimoMensaje = aiMessage.timestamp;
                        
                        if (chat.estado === 'pendiente' || wasReopened) {
                            chat.estado = 'bot_atendiendo';
                        }
                        await chat.save();

                        if (io) {
                            const mensajePayload = {
                                _id: aiMessage._id.toString(),
                                origen: aiMessage.origen,
                                texto: aiMessage.texto,
                                timestamp: aiMessage.timestamp.toISOString(),
                                leido: aiMessage.leido,
                                estado: aiMessage.estado,
                                tipo: aiMessage.tipo,
                            };
                            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
                            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
                            io.to(`chat:${chatId}`).emit('chat:estado_cambiado', { chatId, estado: chat.estado });
                            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', { chatId, estado: chat.estado });
                        }
                        console.log(`[TG-AUTO] Mensaje enviado con éxito. Cancelando IA.`);
                        return; // Salir del handler
                    }
                } catch (autoErr) {
                    console.error("[TG-AUTO] Error:", autoErr.message);
                }
            }

            // IA Fetch (solo si el chat no está bloqueado, no se envió auto-reply y la IA está activa)
            const puedeResponderIA = !autoReplyEnviado
                && lineaActual.gemini_api_key 
                && lineaActual.ia_activa !== false
                && lineaActual.auto_reply_activo !== true
                && chat.tipo_chat !== "conductor" 
                && chat.estado !== "en_atencion"
                && !chat.bloqueado;

            console.log(`[TG-IA-CHECK] line=${lineaActual.name} autoReplyEnviado=${autoReplyEnviado} ia_activa=${lineaActual.ia_activa} auto_reply_activo=${lineaActual.auto_reply_activo} → disparar=${puedeResponderIA}`);
            
            if (puedeResponderIA) {
                try {
                    const baseUrl = `http://127.0.0.1:${port}`;
                    console.log(`[TG-AI] Disparando IA en: ${baseUrl}/api/telegram/ai-reply`);
                    
                    const aiRes = await fetch(`${baseUrl}/api/telegram/ai-reply`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "x-internal-request": "true" // Header para bypass de posibles reglas de redirección
                        },
                        redirect: "follow", 
                        body: JSON.stringify({
                            lineaId,
                            chatId,
                            senderId,
                            wasReopened,
                        }),
                    });

                    if (aiRes.status >= 300 && aiRes.status < 400) {
                        console.error(`[TG-AI-Fetch] Error: El servidor intentó redirigir a ${aiRes.headers.get('location')}. Esto no debería pasar.`);
                    } else if (!aiRes.ok) {
                        console.error(`[TG-AI-Fetch] Error ${aiRes.status}.`);
                    } else {
                        const contentType = aiRes.headers.get("content-type");
                        if (contentType && contentType.includes("application/json")) {
                            const data = await aiRes.json();
                            console.log(`[TG-AI] IA procesada correctamente:`, data);
                        } else {
                            console.error("[TG-AI-Fetch] Error: Se recibió HTML en lugar de JSON. La ruta no fue encontrada por Next.js.");
                        }
                    }
                } catch (aiErr) {
                    console.error("[TG-AI] Fallo en la conexión interna:", aiErr.message);
                }
            }
        } catch (err) {
            console.error("❌ [Telegram Inbound Error]:", err);
        }
    }, new NewMessage({}));
}
