import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
import LineasModel from '@/models/Lineas';
import ConductoresModel from '@/models/Conductores';
import { getGeminiReply } from '@/lib/gemini';

// ─── Verificación HMAC-SHA256 ─────────────────────────────────────────────────
function verifySignature(rawBody: string, signature: string | null, secret?: string): boolean {
    const finalSecret = secret || process.env.WHATSAPP_APP_SECRET;
    if (!finalSecret || !signature) return false;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', finalSecret)
        .update(rawBody, 'utf8')
        .digest('hex');
    // Comparación en tiempo constante (longitudes iguales → safe contra timing attacks)
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
}

// ─── Extraer texto legible según el tipo de mensaje ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(msg: Record<string, any>): string {
    switch (msg.type) {
        case 'text': return msg.text?.body ?? '[Mensaje vacío]';
        case 'image': return msg.image?.caption ? `[Imagen] ${msg.image.caption}` : '[Imagen]';
        case 'video': return msg.video?.caption ? `[Video] ${msg.video.caption}` : '[Video]';
        case 'document': return msg.document?.caption ? `[Documento] ${msg.document.caption}` : '[Documento]';
        case 'audio':
        case 'voice': return '[Audio]';
        case 'sticker': return '[Sticker]';
        case 'location': return `[Ubicación: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
        case 'contacts': return '[Contacto]';
        case 'reaction': return `[Reacción: ${msg.reaction?.emoji ?? ''}]`;
        default: return '[Mensaje no soportado]';
    }
}

// ─── Extraer URL del proxy de Medio local si existe ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMediaUrl(msg: Record<string, any>, lineaId: string): string | undefined {
    let mediaId = null;
    switch (msg.type) {
        case 'image': mediaId = msg.image?.id; break;
        case 'video': mediaId = msg.video?.id; break;
        case 'document': mediaId = msg.document?.id; break;
        case 'audio':
        case 'voice': mediaId = msg.audio?.id || msg.voice?.id; break;
        case 'sticker': mediaId = msg.sticker?.id; break;
    }
    if (mediaId) {
        return `/api/whatsapp/media/${mediaId}?lineaId=${lineaId}`;
    }
    return undefined;
}

// ─── GET — Verificación del webhook ──────────────────────────────────────────
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[webhook] WEBHOOK_VERIFIED');
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

// ─── POST — Recepción de mensajes entrantes ───────────────────────────────────
export async function POST(req: NextRequest) {
    console.log(`[webhook] POST recibido a las ${new Date().toISOString()}`);
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    try {
        const body = JSON.parse(rawBody);
        const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

        let lineaSecret = undefined;
        if (phoneNumberId) {
            await connectDB();
            const linea = await LineasModel.findOne({ phone_number_id: phoneNumberId }).select('+app_secret').lean();
            if (linea?.app_secret) {
                lineaSecret = linea.app_secret;
                console.log(`[webhook] Usando App Secret específico para la línea: ${linea.name}`);
            }
        }

        if (!verifySignature(rawBody, signature, lineaSecret)) {
            console.warn('[webhook] Firma inválida rechazada');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        await processWebhook(body);
    } catch (err: unknown) {
        console.error('[webhook] Error procesando payload:', err);
    }

    return NextResponse.json({ success: true });
}

// ─── Procesamiento del payload ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processWebhook(body: Record<string, any>) {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Solo procesar eventos con mensajes o con actualizaciones de estado
    if (!value?.messages?.length && !value?.statuses?.length) return;

    const phoneNumberId: string = value.metadata?.phone_number_id;
    console.log(`[webhook] Recibido evento para phone_number_id: ${phoneNumberId}`);
    if (!phoneNumberId) return;

    await connectDB();

    // 2. Identificar la línea por phone_number_id
        const linea = await LineasModel
            .findOne({ phone_number_id: phoneNumberId })
            .select('+phone_number_id +access_token +gemini_api_key +gemini_prompt +ia_activa +auto_reply_activo +auto_reply_mensaje')
            .lean();

    if (!linea) {
        console.warn(`[webhook] Ninguna línea encontrada para phone_number_id=${phoneNumberId}. Asegúrate de que el ID coincide en la base de datos.`);
        return;
    }
    console.log(`[webhook] Línea encontrada: ${linea.name} (activa: ${linea.activa})`);

    if (linea.activa === false) {
        console.warn(`[webhook] Mensaje ignorado: La línea "${linea.name}" (${phoneNumberId}) está inactiva.`);
        return;
    }

    const lineaId = linea._id.toString();

    // 2.5 Manejar actualizaciones de estado (Enviado, Entregado, Leído, Fallido)
    if (value?.statuses?.length) {
        for (const status of value.statuses) {
            const wa_message_id = status.id;
            const new_status = status.status;
            
            const statusMap: Record<string, "pendiente" | "enviado" | "entregado" | "leido" | "fallido"> = {
                'sent': 'enviado',
                'delivered': 'entregado',
                'read': 'leido',
                'failed': 'fallido'
            };
            const mappedStatus = statusMap[new_status];
            if (!mappedStatus) continue;

            const chat = await ChatsModel.findOne({
                linea: lineaId,
                "mensajes.wa_message_id": wa_message_id
            });

            if (chat) {
                const msgIndex = chat.mensajes.findIndex((m: any) => m.wa_message_id === wa_message_id);
                if (msgIndex !== -1) {
                    // Update state safely
                    (chat.mensajes[msgIndex] as any).estado = mappedStatus;
                    await chat.save();

                    // Emitir socket event para actualizar el checkmark
                    const io = (global as { io?: import('socket.io').Server }).io;
                    if (io) {
                        io.to(`chat:${chat._id}`).emit('chat:mensaje_estado', {
                            chatId: chat._id.toString(),
                            mensajeId: chat.mensajes[msgIndex]._id.toString(),
                            estado: mappedStatus
                        });
                    }
                }
            }
        }
        
        // Si el payload SOLO contenía estados y no nuevos mensajes, interrumpir acá
        if (!value?.messages?.length) return;
    }

    // 3. Procesar cada mensaje del batch
    for (const msg of value.messages) {
        // Ignorar mensajes enviados por nosotros mismos (Meta hace "eco")
        if (msg?.from === linea.whatsapp_number) continue;

        // ── Deduplicación: si ya procesamos este mensaje, ignorar ──────────
        // WhatsApp puede reenviar el mismo webhook varias veces (retries).
        // Sin esta verificación se disparan múltiples llamadas a Gemini.
        if (msg.id) {
            const yaExiste = await ChatsModel.findOne({
                linea: lineaId,
                "mensajes.wa_message_id": msg.id,
            }).select("_id").lean();
            if (yaExiste) {
                console.log(`[webhook] Mensaje duplicado ignorado: wa_message_id=${msg.id}`);
                continue;
            }
        }

        const clientePhone: string = msg.from; // E.164 sin "+"
        const texto = extractText(msg);
        const timestamp = new Date(parseInt(msg.timestamp, 10) * 1000);
        const tipo = msg.type || 'text';
        const media_url = extractMediaUrl(msg, lineaId);

        // 4. Buscar perfil del contacto (nombre si Meta lo envía)
        const contactos = value.contacts ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contact = contactos.find((c: any) => c.wa_id === clientePhone);
        const clienteNombre: string | undefined = contact?.profile?.name;

        // 5. Buscar o crear el Chat (upsert)
        const nuevoMensaje = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'cliente' as const,
            texto,
            timestamp,
            leido: false,
            wa_message_id: msg.id,
            estado: 'entregado' as const, // Incoming is already delivered
            tipo,
            media_url
        };

        // Detectar si el remitente es un conductor registrado de esta línea
        const conductorDoc = await ConductoresModel.findOne({
            linea: lineaId,
            telefono: clientePhone,
            activo: true,
        });

        const { doc: chat, isNew, wasReopened } = await upsertChat({
            lineaId,
            clientePhone,
            clienteNombre,
            mensaje: nuevoMensaje,
            tipoChatOverride: conductorDoc ? 'conductor' : undefined,
            conductorId: conductorDoc?._id,
        });

        if (!chat) continue;

        const chatId = chat._id.toString();
        const io = (global as { io?: import('socket.io').Server }).io;

        // Si la línea NO tiene IA configurada, el chat va directo a esperando_operador
        // (se saltan los estados pendiente y bot_atendiendo)
        if (!linea.gemini_api_key && (chat.estado === 'pendiente' || wasReopened)) {
            chat.estado = 'esperando_operador';
            await chat.save();
            // Notificar el cambio de estado al sidebar
            if (io) {
                io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', {
                    chatId,
                    estado: chat.estado,
                });
            }
        }
        // Conductores también van directo a esperando_operador
        if (conductorDoc && chat.estado === 'pendiente') {
            chat.estado = 'esperando_operador';
            await chat.save();
            if (io) {
                io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', {
                    chatId,
                    estado: chat.estado,
                });
            }
        }

        // 6. Emitir Socket.io del mensaje del CLIENTE primero (para que aparezca antes que la IA)
        if (io) {
            if (isNew) {
                const chatPopulated = await ChatsModel.findById(chat._id)
                    .populate('linea', 'name')
                    .populate('conductor', 'nombre telefono unidad foto_identificacion')
                    .lean();

                if (chatPopulated) {
                    io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_chat', {
                        _id: chatPopulated._id.toString(),
                        linea: chatPopulated.linea,
                        cliente_phone: chatPopulated.cliente_phone,
                        cliente_nombre: chatPopulated.cliente_nombre,
                        tipo_chat: chatPopulated.tipo_chat,
                        conductor: chatPopulated.conductor,
                        estado: chatPopulated.estado,
                        ultimoMensaje: timestamp.toISOString(),
                    });
                }
            } else {
                // Inyectar la burbuja del cliente en la sala activa
                io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', {
                    chatId,
                    mensaje: {
                        _id: nuevoMensaje._id.toString(),
                        origen: nuevoMensaje.origen,
                        texto: nuevoMensaje.texto,
                        timestamp: nuevoMensaje.timestamp.toISOString(),
                        leido: nuevoMensaje.leido,
                        tipo: nuevoMensaje.tipo,
                        media_url: nuevoMensaje.media_url
                    },
                });
            }
        }

        // 7. Integración de Inteligencia Artificial (Gemini) O Respuesta Automática
        let aiReplied = false;
        const isConductorChat = chat.tipo_chat === 'conductor';

        // 7a. PRIORIDAD: Respuesta Automática (si está activa y configurada)
        const autoReplyHabilitado = linea.auto_reply_activo && linea.auto_reply_mensaje;
        if (autoReplyHabilitado && !isConductorChat && chat.estado !== 'en_atencion') {
            console.log(`[webhook] Enviando respuesta automática para ${clientePhone}...`);
            try {
                const now = new Date();
                const replyText = linea.auto_reply_mensaje;

                const metaRes = await fetch(`https://graph.facebook.com/v21.0/${linea.phone_number_id}/messages`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${linea.access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: clientePhone,
                        type: "text",
                        text: { body: replyText },
                    }),
                });

                const metaData = await metaRes.json();
                const wa_message_id = metaData?.messages?.[0]?.id;

                const autoMensaje = {
                    _id: new mongoose.Types.ObjectId(),
                    origen: 'sistema' as const,
                    texto: replyText,
                    timestamp: now,
                    leido: true,
                    estado: 'enviado' as const,
                    wa_message_id: wa_message_id,
                };

                chat.mensajes.push(autoMensaje as any);
                chat.ultimoMensaje = autoMensaje.timestamp;

                if (chat.estado === 'pendiente' || wasReopened) {
                    chat.estado = 'bot_atendiendo';
                }

                await chat.save();
                aiReplied = true;

                // Emitir la burbuja al chat abierto
                if (io && !isNew) {
                    io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', {
                        chatId,
                        mensaje: {
                            _id: autoMensaje._id.toString(),
                            origen: autoMensaje.origen,
                            texto: autoMensaje.texto,
                            timestamp: autoMensaje.timestamp.toISOString(),
                            estado: autoMensaje.estado,
                        },
                    });
                }

                // Notificar cambio de estado al sidebar
                if (io) {
                    io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', {
                        chatId,
                        estado: chat.estado,
                    });
                }
            } catch (error) {
                console.error("[webhook] Error enviando respuesta automática:", error);
            }
        }

        // 7b. SEGUNDA OPCIÓN: Inteligencia Artificial (Gemini)
        // Solo respondemos si NO se envió auto-reply, hay API Key, etc.
        const iaHabilitada = !aiReplied && linea.gemini_api_key && linea.ia_activa !== false;
        if (iaHabilitada && !isConductorChat && chat.estado !== 'en_atencion') {
            console.log(`[gemini] Generando respuesta para ${clientePhone}...`);
            const aiResult = await getGeminiReply({
                apiKey: linea.gemini_api_key!,
                lineaName: linea.name,
                // Si el chat fue reabierto desde "cerrado", solo pasar el último mensaje
                // para que la IA inicie una conversación completamente nueva
                chatHistoria: wasReopened ? [nuevoMensaje] : chat.mensajes,
                clienteName: clienteNombre,
                customPrompt: linea.gemini_prompt
            });

            if (aiResult) {
                console.log(`[gemini] aiResult recibido: text=${aiResult.text?.substring(0, 80)}... thinking=${!!aiResult.thinking} handoff=${aiResult.handoff} noResponse=${aiResult.noResponse}`);
                try {
                    const now = new Date();

                    // 7a. Guardar pensamiento interno (si existe) — SIEMPRE, antes de cualquier decisión
                    if (aiResult.thinking) {
                        const thinkingMensaje = {
                            _id: new mongoose.Types.ObjectId(),
                            origen: 'sistema' as const,
                            texto: aiResult.thinking,
                            timestamp: new Date(now.getTime() - 1),
                            leido: true,
                            estado: 'entregado' as const,
                            tipo: 'ai_thinking',
                        };
                        chat.mensajes.push(thinkingMensaje as any);

                        if (io && !isNew) {
                            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', {
                                chatId,
                                mensaje: {
                                    _id: thinkingMensaje._id.toString(),
                                    origen: thinkingMensaje.origen,
                                    texto: thinkingMensaje.texto,
                                    timestamp: thinkingMensaje.timestamp.toISOString(),
                                    tipo: 'ai_thinking',
                                },
                            });
                        }
                    }

                    // 7b. Si la IA decidió que NO necesita responder → solo guardamos el pensamiento
                    if (aiResult.noResponse || !aiResult.text) {
                        console.log(`[gemini] No se requiere respuesta al cliente. Solo pensamiento guardado.`);
                        await chat.save();
                        aiReplied = true;
                    } else {
                        // 7c. Enviar respuesta visible al cliente por WhatsApp
                        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${linea.phone_number_id}/messages`, {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${linea.access_token}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                messaging_product: "whatsapp",
                                to: clientePhone,
                                type: "text",
                                text: { body: aiResult.text },
                            }),
                        });

                        const metaData = await metaRes.json();
                        const wa_message_id = metaData?.messages?.[0]?.id;

                        const aiMensaje = {
                            _id: new mongoose.Types.ObjectId(),
                            origen: 'sistema' as const,
                            texto: aiResult.text,
                            timestamp: now,
                            leido: true,
                            estado: 'enviado' as const,
                            wa_message_id: wa_message_id,
                        };

                        chat.mensajes.push(aiMensaje as any);
                        chat.ultimoMensaje = aiMensaje.timestamp;

                        // Transición de estado automática
                        if (aiResult.handoff) {
                            chat.estado = 'esperando_operador';
                            console.log(`[gemini] Handoff detectado → estado=esperando_operador`);
                        } else if (chat.estado === 'pendiente') {
                            chat.estado = 'bot_atendiendo';
                        }

                        await chat.save();
                        aiReplied = true;
                        console.log(`[gemini] Respuesta automática enviada y guardada.`);

                        // Emitir la burbuja de la IA al chat abierto
                        if (io && !isNew) {
                            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', {
                                chatId,
                                mensaje: {
                                    _id: aiMensaje._id.toString(),
                                    origen: aiMensaje.origen,
                                    texto: aiMensaje.texto,
                                    timestamp: aiMensaje.timestamp.toISOString(),
                                    estado: aiMensaje.estado,
                                },
                            });
                        }

                        // Notificar cambio de estado al sidebar
                        if (io) {
                            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', {
                                chatId,
                                estado: chat.estado,
                            });
                        }
                    }

                } catch (error) {
                    console.error("[gemini] Error enviando respuesta automática por Meta Graph:", error);
                }
            }
        }

        // 8. Actualizar ultimoMensaje en la vista de lista del sidebar
        if (io && !isNew) {
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', {
                chatId,
                mensaje: {
                    _id: aiReplied ? chat.mensajes[chat.mensajes.length - 1]._id.toString() : nuevoMensaje._id.toString(),
                    origen: aiReplied ? 'sistema' : nuevoMensaje.origen,
                    texto: aiReplied ? chat.mensajes[chat.mensajes.length - 1].texto : nuevoMensaje.texto,
                    timestamp: aiReplied ? chat.ultimoMensaje.toISOString() : nuevoMensaje.timestamp.toISOString(),
                    estado: aiReplied ? 'enviado' : 'pendiente',
                    tipo: aiReplied ? 'text' : nuevoMensaje.tipo,
                    media_url: aiReplied ? undefined : nuevoMensaje.media_url
                },
            });
        }

        console.log(`[webhook] Mensaje guardado — chat=${chatId} linea=${lineaId} from=${clientePhone}`);
    }
}

// ─── Upsert del chat ──────────────────────────────────────────────────────────
interface UpsertChatArgs {
    lineaId: string;
    clientePhone: string;
    clienteNombre?: string;
    tipoChatOverride?: 'conductor';
    conductorId?: mongoose.Types.ObjectId;
    mensaje: {
        _id: mongoose.Types.ObjectId;
        origen: 'cliente' | 'operador' | 'sistema';
        texto: string;
        timestamp: Date;
        leido: boolean;
        wa_message_id?: string;
        estado?: "pendiente" | "enviado" | "entregado" | "leido" | "fallido";
        tipo?: string;
        media_url?: string;
    };
}

async function upsertChat({ lineaId, clientePhone, clienteNombre, mensaje, tipoChatOverride, conductorId }: UpsertChatArgs) {
    const now = mensaje.timestamp;

    // Intentar buscar el chat existente primero
    let isNew = false;
    let wasReopened = false;
    let chat = await ChatsModel.findOne({ linea: lineaId, cliente_phone: clientePhone });

    if (!chat) {
        // Crear nuevo chat
        isNew = true;
        try {
            chat = await ChatsModel.create({
                linea: lineaId,
                cliente_phone: clientePhone,
                cliente_nombre: clienteNombre,
                estado: 'pendiente',
                tipo_chat: tipoChatOverride || 'cliente',
                ...(conductorId ? { conductor: conductorId } : {}),
                mensajes: [mensaje],
                ultimoMensaje: now,
            });
        } catch (err: unknown) {
            // Race condition: otro proceso lo creó justo ahora
            if ((err as { code?: number }).code === 11000) {
                chat = await ChatsModel.findOne({ linea: lineaId, cliente_phone: clientePhone });
                if (chat) {
                    chat.mensajes.push(mensaje);
                    chat.ultimoMensaje = now;
                    if (clienteNombre && !chat.cliente_nombre) chat.cliente_nombre = clienteNombre;
                    await chat.save();
                }
                isNew = false;
            } else {
                throw err;
            }
        }
    } else {
        // Agregar mensaje al chat existente
        chat.mensajes.push(mensaje);
        chat.ultimoMensaje = now;
        if (clienteNombre && !chat.cliente_nombre) chat.cliente_nombre = clienteNombre;
        // Si el chat estaba cerrado, reabrirlo para reiniciar el flujo
        if (chat.estado === 'cerrado') {
            chat.estado = 'pendiente';
            wasReopened = true;
        }
        await chat.save();
    }

    return { doc: chat, isNew, wasReopened };
}
