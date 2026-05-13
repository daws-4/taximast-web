import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel, { IMessage } from '@/models/Chats';
import LineasModel from '@/models/Lineas';
import ConductoresModel from '@/models/Conductores';
import { getDriverPhotoUrl } from '@/lib/pocketbase';

const WA_API_VERSION = 'v21.0';
const WA_API_BASE = 'https://graph.facebook.com';

// ── Interfaces del payload de FoxPro ────────────────────────────────────────
interface DispatchDriver {
    phone?: string;
    numero?: string;
    name?: string;
    nombre?: string;
    unit?: string;
    mensaje?: string;
}

interface DispatchClient {
    phone?: string;
    numero?: string;
    name?: string;
    nombre?: string;
    address?: string;
    mensaje?: string;
}

interface DispatchBody {
    line_id: string;
    line_name?: string;
    phone: string;
    message: string;
    type: 'dispatch_driver' | 'dispatch_client' | 'general';
    driver?: DispatchDriver;
    client?: DispatchClient;
    conductor?: DispatchDriver;
    cliente?: DispatchClient;
}

// ── POST /api/dispatch (Endpoint Omnicanal) ─────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        // 0. Validar API key enviada por FoxPro en el header x-api-key
        const authError = validateApiKey(req);
        if (authError) return authError;

        const body: DispatchBody = await req.json();
        console.log(" [VFP-DEBUG] Payload recibido:", JSON.stringify(body, null, 2));
        const { line_id, phone, message, type = 'general', driver, client, conductor, cliente } = body;

        // 1. Validar campos requeridos
        if (!line_id || !phone || !message) {
            return NextResponse.json(
                { success: false, error: 'Se requieren line_id, phone y message' },
                { status: 400 }
            );
        }

        await connectDB();

        // 2. Buscar la línea con credenciales
        const linea = await LineasModel
            .findById(line_id)
            .select('+phone_number_id +access_token +telegram_api_id +isWhatsappConfigured +isTelegramConfigured')
            .lean();

        if (!linea) {
            return NextResponse.json({ success: false, error: 'Línea no encontrada' }, { status: 404 });
        }
        if (linea.activa === false) {
            return NextResponse.json({ success: false, error: 'La línea está inactiva' }, { status: 403 });
        }

        // Determinar plataforma de despacho según configuración de la línea
        const dispatchPlatform = linea.plataforma_despacho || 'whatsapp';

        // Validar credenciales de la plataforma seleccionada mediante los flags (con fallback para líneas no migradas)
        const isWAConfigured = linea.isWhatsappConfigured || (linea.phone_number_id && linea.access_token);
        const isTGConfigured = linea.isTelegramConfigured || linea.telegram_api_id;

        if (dispatchPlatform === 'telegram' && !isTGConfigured) {
            return NextResponse.json({ success: false, error: 'La línea no tiene Telegram configurado para despachos' }, { status: 400 });
        }
        if (dispatchPlatform === 'whatsapp' && !isWAConfigured) {
            return NextResponse.json({ success: false, error: 'La línea no tiene WhatsApp configurado para despachos' }, { status: 400 });
        }

        let sentAsImage = false;
        let photoUrl: string | undefined = undefined;
        let conductorId: mongoose.Types.ObjectId | undefined = undefined;

        // 3. Según el tipo, decidir cómo enviar
        let finalMessage = message;
        
        if (type === 'dispatch_driver') {
            // Eliminar cualquier enlace de Google Maps y la " A " ocasional que lo precede
            finalMessage = finalMessage.replace(/\s*(?:A\s+)?https?:\/\/(?:www\.)?(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)[^\s]*/gi, '').trim();

            // Eliminar el número de teléfono del cliente (ej: "TEL: 584120691296") del mensaje al chófer
            finalMessage = finalMessage.replace(/\s*TEL:\s*\+?\d+/gi, '').trim();

            // 3.0 RESTRICCIÓN TELEGRAM: Validar que el chófer exista si la plataforma es Telegram
            const driverPhoneVariants = getPhoneVariants(phone);
            console.log(`[dispatch-telegram] Buscando chófer: ${phone} | Variantes: ${JSON.stringify(driverPhoneVariants)} | LineaID: ${linea._id}`);
            
            const conductorRecord = await ConductoresModel.findOne({
                telefono: { $in: driverPhoneVariants },
                linea: linea._id,
            }).lean();

            if (conductorRecord) {
                console.log(` [VFP-DEBUG] Chófer encontrado: ${conductorRecord.nombre} (${conductorRecord._id}) | Tel: ${conductorRecord.telefono}`);
                conductorId = conductorRecord._id as mongoose.Types.ObjectId;
            } else {
                console.log(` [VFP-DEBUG] Chófer NO encontrado en la BD para la línea ${linea._id} y variantes ${JSON.stringify(driverPhoneVariants)}`);
                if (dispatchPlatform === 'telegram') {
                    console.log(`[dispatch-telegram] Envío cancelado: Chófer ${phone} no registrado.`);
                    return NextResponse.json({ 
                        success: false, 
                        error: 'Despacho denegado: El chófer no está registrado en el sistema para recibir mensajes por Telegram.' 
                    }, { status: 403 });
                }
            }
        }

        if (type === 'dispatch_client') {
            // Eliminar el número de teléfono del chófer del mensaje al cliente (ej: "TEL. CHOFER: 584247315840")
            finalMessage = finalMessage.replace(/\s*TEL\.?\s*(?:CHOFER)?:?\s*\+?\d+/gi, '').trim();

            // Extraer el teléfono del conductor directamente del objeto 'conductor' si FoxPro lo incluyó
            let targetDriverPhone = conductor?.numero || conductor?.phone || driver?.phone;
            
            // Fallback al string del mensaje si no viene en las propiedades estructuradas
            if (!targetDriverPhone) {
                const choferMatch = message.match(/CHOFER:\s*(\d+)/i);
                if (choferMatch && choferMatch[1]) {
                    targetDriverPhone = choferMatch[1];
                }
            }

            console.log(`[dispatch-${dispatchPlatform}] dispatch_client: targetDriverPhone extraido=${targetDriverPhone}`);

            if (targetDriverPhone) {
                // 3.1 Intentar obtener la foto desde la base de datos (MongoDB) primero
                const driverPhoneVariants = getPhoneVariants(targetDriverPhone);
                console.log(`[dispatch-${dispatchPlatform}] dispatch_client: Buscando chófer: ${targetDriverPhone} | Variantes: ${JSON.stringify(driverPhoneVariants)} | LineaID: ${linea._id}`);
                
                const conductorRecord = await ConductoresModel.findOne({
                    telefono: { $in: driverPhoneVariants },
                    linea: linea._id, // Filtro estricto por línea
                }).lean();

                if (conductorRecord) {
                    console.log(`[dispatch-${dispatchPlatform}] Conductor encontrado en BD: ${conductorRecord.nombre} (${conductorRecord._id})`);
                    conductorId = conductorRecord._id as mongoose.Types.ObjectId;
                    if (conductorRecord.foto_identificacion) {
                        photoUrl = conductorRecord.foto_identificacion;
                        sentAsImage = true;
                    }
                } else {
                    console.log(`[dispatch-${dispatchPlatform}] NO se encontro conductor en esta línea (MongoDB). Validando en PocketBase...`);
                    
                    // 3.2 Si no hay foto en MongoDB, intentar el helper de PocketBase
                    // Pero SOLO si estamos seguros de que el teléfono es válido para esta operación
                    const pbPhoto = await getDriverPhotoUrl(targetDriverPhone);
                    if (pbPhoto) {
                        // OJO: PocketBase no tiene filtro por línea, así que solo lo usamos 
                        // si no encontramos nada en MongoDB pero queremos intentar el fallback de imagen.
                        photoUrl = pbPhoto;
                        sentAsImage = true;
                    }
                }
            }
        }

        // Normalizar teléfono destino según plataforma
        const destPhone = dispatchPlatform === 'telegram' 
            ? normalizePhoneForTG(phone) 
            : normalizePhoneForWA(phone);

        let finalMessageId = `dispatch-${Date.now()}`;

        // 4. Enviar a la plataforma correspondiente
        if (dispatchPlatform === 'whatsapp') {
            const waUrl = `${WA_API_BASE}/${WA_API_VERSION}/${linea.phone_number_id}/messages`;
            const headers = {
                'Authorization': `Bearer ${linea.access_token}`,
                'Content-Type': 'application/json',
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let waPayload: Record<string, any>;
            
            if (sentAsImage && photoUrl) {
                waPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: destPhone,
                    type: 'image',
                    image: { link: photoUrl, caption: finalMessage },
                };
            } else {
                waPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: destPhone,
                    type: 'text',
                    text: { preview_url: false, body: finalMessage },
                };
            }

            const waResponse = await fetch(waUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(waPayload),
            });

            if (!waResponse.ok) {
                const waError = await waResponse.json().catch(() => ({}));
                console.error('[dispatch-whatsapp] Error de WhatsApp API:', waError);
                return NextResponse.json(
                    { success: false, error: 'Error al enviar el mensaje por WhatsApp', detail: waError },
                    { status: 502 }
                );
            }

            const waData = await waResponse.json();
            finalMessageId = waData?.messages?.[0]?.id ?? finalMessageId;

        } else if (dispatchPlatform === 'telegram') {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const tgResponse = await fetch(`${baseUrl}/internal/telegram/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_id,
                    phone: destPhone,
                    message: finalMessage,
                    mediaUrl: sentAsImage ? photoUrl : null,
                    type: type // Pasamos el tipo (dispatch_driver) para saltar bloqueos en server.mjs
                }),
            });

            if (!tgResponse.ok) {
                const tgError = await tgResponse.json().catch(() => ({}));
                console.error('[dispatch-telegram] Error enviando por Telegram:', tgError);
                return NextResponse.json(
                    { success: false, error: 'Error al enviar por Telegram', detail: tgError },
                    { status: 502 }
                );
            }
            finalMessageId = `tg-dispatch-${Date.now()}`;
        }

        // 5. Registrar en la base de datos (upsert del chat)
        const lineaId = linea._id.toString();
        const now = new Date();

        const nuevoMensaje: IMessage = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'sistema',
            texto: finalMessage, 
            timestamp: now,
            leido: true,
            estado: 'enviado',
            tipo: (sentAsImage && photoUrl) ? 'image' : 'text',
            media_url: (sentAsImage && photoUrl) ? photoUrl : undefined,
            ...(dispatchPlatform === 'whatsapp' ? { wa_message_id: finalMessageId } : {}),
            ...(dispatchPlatform === 'telegram' ? { tg_peer_id: 'dispatch' } : {}),
        };

        const destinatarioNombre = type === 'dispatch_client' ? client?.name : driver?.name;

        let chat = await ChatsModel.findOne({ linea: lineaId, cliente_phone: destPhone, platform: dispatchPlatform });
        
        // Verificar si el usuario está bloqueado para recibir mensajes
        if (chat && chat.bloqueado) {
            console.log(`[dispatch-${dispatchPlatform}] Envío cancelado: El usuario ${destPhone} está marcado como EXENTO (bloqueado).`);
            return NextResponse.json({ 
                success: false, 
                error: 'El usuario ha solicitado no recibir más mensajes por esta vía.' 
            }, { status: 403 });
        }

        const isNewChat = !chat;

        if (!chat) {
            chat = await ChatsModel.create({
                linea: lineaId,
                cliente_phone: destPhone,
                cliente_nombre: destinatarioNombre,
                tipo_chat: type === 'dispatch_driver' ? 'conductor' : 'cliente',
                conductor: conductorId,
                estado: type === 'dispatch_client' ? 'cerrado' : 'en_atencion',
                platform: dispatchPlatform,
                mensajes: [nuevoMensaje],
                ultimoMensaje: now,
            });
        } else {
            chat.mensajes.push(nuevoMensaje);
            chat.ultimoMensaje = now;
            if (destinatarioNombre && !chat.cliente_nombre) {
                chat.cliente_nombre = destinatarioNombre;
            }
            if (conductorId && !chat.conductor) {
                chat.conductor = conductorId;
                if (type === 'dispatch_driver') chat.tipo_chat = 'conductor';
            }
            if (type === 'dispatch_client') {
                chat.estado = 'cerrado';
            } else if (type === 'dispatch_driver') {
                chat.estado = 'en_atencion';
                chat.tipo_chat = 'conductor';
            }
            await chat.save();
        }

        // 6. Emitir Socket.io para panel web
        const io = (global as { io?: import('socket.io').Server }).io;
        if (io) {
            const chatId = chat._id.toString();
            const mensajePayload = {
                _id: nuevoMensaje._id.toString(),
                origen: nuevoMensaje.origen,
                texto: nuevoMensaje.texto,
                timestamp: now.toISOString(),
                leido: true,
                estado: nuevoMensaje.estado,
                tipo: nuevoMensaje.tipo,
                media_url: nuevoMensaje.media_url,
            };

            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });

            if (isNewChat) {
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
                        platform: chatPopulated.platform,
                        ultimoMensaje: chatPopulated.ultimoMensaje,
                    });
                }
            }

            if (type === 'dispatch_client' || type === 'dispatch_driver') {
                const newEstado = type === 'dispatch_client' ? 'cerrado' : 'en_atencion';
                io.to(`chat:${chatId}`).emit('chat:estado_cambiado', { chatId, estado: newEstado });
                io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', { chatId, estado: newEstado });
            }
        }

        return NextResponse.json({ success: true, messageId: finalMessageId, platform: dispatchPlatform });
    } catch (error) {
        console.error('[dispatch] Error interno:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

function normalizePhoneForWA(phone: string): string {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) {
        p = '58' + p.slice(1);
    }
    if (p.length === 10) {
        p = '58' + p;
    }
    return p;
}

function normalizePhoneForTG(phone: string): string {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) {
        p = '58' + p.slice(1);
    }
    if (p.length === 10) {
        p = '58' + p;
    }
    return p;
}

function getPhoneVariants(phone: string): string[] {
    let p = phone.replace(/\D/g, '');
    let norm = p;
    if (p.startsWith('58')) norm = p.slice(2);
    else if (p.startsWith('0')) norm = p.slice(1);
    
    return [
        phone,       
        norm,        
        `0${norm}`,  
        `58${norm}`, 
        `+58${norm}` 
    ];
}
