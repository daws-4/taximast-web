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

interface DispatchLine {
    _id: mongoose.Types.ObjectId;
    activa?: boolean;
    name?: string;
    plataforma_despacho?: 'whatsapp' | 'telegram' | string;
    phone_number_id?: string;
    access_token?: string;
    telegram_api_id?: string | number;
    isWhatsappConfigured?: boolean;
    isTelegramConfigured?: boolean;
}

interface DispatchContext {
    body: DispatchBody;
    linea: DispatchLine;
    dispatchPlatform: 'whatsapp' | 'telegram';
}

export async function POST(req: NextRequest) {
    try {
        const authError = validateApiKey(req);
        if (authError) return authError;

        const body: DispatchBody = await req.json();
        console.log('[dispatch] Payload recibido:', JSON.stringify(body, null, 2));

        const { line_id, phone, message } = body;
        if (!line_id || !phone || !message) {
            return NextResponse.json(
                { success: false, error: 'Se requieren line_id, phone y message' },
                { status: 400 }
            );
        }

        await connectDB();

        const linea = await loadDispatchLine(line_id);
        if (!linea) {
            return NextResponse.json({ success: false, error: 'Línea no encontrada' }, { status: 404 });
        }
        if (linea.activa === false) {
            return NextResponse.json({ success: false, error: 'La línea está inactiva' }, { status: 403 });
        }

        const dispatchPlatform = getDispatchPlatform(linea);
        const platformError = getPlatformConfigError(linea, dispatchPlatform);
        if (platformError) {
            return NextResponse.json({ success: false, error: platformError }, { status: 400 });
        }

        const acceptedMessageId = `dispatch-accepted-${Date.now()}`;
        setTimeout(() => {
            void processDispatchInBackground({ body, linea, dispatchPlatform }).catch((error) => {
                console.error('[dispatch:bg] Error interno:', error);
            });
        }, 0);

        return NextResponse.json({
            success: true,
            queued: true,
            messageId: acceptedMessageId,
            platform: dispatchPlatform,
        });
    } catch (error) {
        console.error('[dispatch] Error interno:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

async function processDispatchInBackground({ body, linea, dispatchPlatform }: DispatchContext) {
    await connectDB();

    const {
        line_id,
        phone,
        message,
        type = 'general',
        driver,
        client,
        conductor,
    } = body;

    let sentAsImage = false;
    let photoUrl: string | undefined;
    let conductorId: mongoose.Types.ObjectId | undefined;
    let finalMessage = message;

    if (type === 'dispatch_driver') {
        finalMessage = finalMessage
            .replace(/\s*(?:A\s+)?https?:\/\/(?:www\.)?(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)[^\s]*/gi, '')
            .replace(/\s*TEL:\s*\+?\d+/gi, '')
            .trim();

        const driverPhoneVariants = getPhoneVariants(phone);
        console.log(`[dispatch-telegram] Buscando chófer: ${phone} | Variantes: ${JSON.stringify(driverPhoneVariants)} | LineaID: ${linea._id}`);

        const conductorRecord = await ConductoresModel.findOne({
            telefono: { $in: driverPhoneVariants },
            linea: linea._id,
        }).lean();

        if (conductorRecord) {
            console.log(`[dispatch:bg] Chófer encontrado: ${conductorRecord.nombre} (${conductorRecord._id}) | Tel: ${conductorRecord.telefono}`);
            conductorId = conductorRecord._id as mongoose.Types.ObjectId;
        } else {
            console.log(`[dispatch:bg] Chófer no encontrado en la línea ${linea._id} para variantes ${JSON.stringify(driverPhoneVariants)}`);
            if (dispatchPlatform === 'telegram') {
                console.log(`[dispatch:bg] Envío cancelado: chófer ${phone} no registrado para Telegram.`);
                return;
            }
        }
    }

    if (type === 'dispatch_client') {
        finalMessage = finalMessage.replace(/\s*TEL\.?\s*(?:CHOFER)?:?\s*\+?\d+/gi, '').trim();

        let targetDriverPhone = conductor?.numero || conductor?.phone || driver?.phone;
        if (!targetDriverPhone) {
            const choferMatch = message.match(/CHOFER:\s*(\d+)/i);
            if (choferMatch?.[1]) {
                targetDriverPhone = choferMatch[1];
            }
        }

        console.log(`[dispatch-${dispatchPlatform}] dispatch_client: targetDriverPhone extraido=${targetDriverPhone}`);

        if (targetDriverPhone) {
            const driverPhoneVariants = getPhoneVariants(targetDriverPhone);
            console.log(`[dispatch-${dispatchPlatform}] dispatch_client: Buscando chófer: ${targetDriverPhone} | Variantes: ${JSON.stringify(driverPhoneVariants)} | LineaID: ${linea._id}`);

            const conductorRecord = await ConductoresModel.findOne({
                telefono: { $in: driverPhoneVariants },
                linea: linea._id,
            }).lean();

            if (conductorRecord) {
                console.log(`[dispatch-${dispatchPlatform}] Conductor encontrado en BD: ${conductorRecord.nombre} (${conductorRecord._id})`);
                conductorId = conductorRecord._id as mongoose.Types.ObjectId;
                if (conductorRecord.foto_identificacion) {
                    photoUrl = conductorRecord.foto_identificacion;
                    sentAsImage = true;
                }
            } else {
                console.log(`[dispatch-${dispatchPlatform}] No se encontró conductor en MongoDB. Intentando PocketBase...`);
                const pbPhoto = await getDriverPhotoUrl(targetDriverPhone);
                if (pbPhoto) {
                    photoUrl = pbPhoto;
                    sentAsImage = true;
                }
            }
        }
    }

    const destPhone = dispatchPlatform === 'telegram'
        ? normalizePhoneForTG(phone)
        : normalizePhoneForWA(phone);

    let finalMessageId = `dispatch-${Date.now()}`;

    if (dispatchPlatform === 'whatsapp') {
        finalMessageId = await sendWhatsappDispatch({
            linea,
            destPhone,
            finalMessage,
            sentAsImage,
            photoUrl,
            fallbackMessageId: finalMessageId,
        });
    } else {
        await sendTelegramDispatch({
            line_id,
            destPhone,
            finalMessage,
            mediaUrl: sentAsImage ? (photoUrl ?? null) : null,
            type,
        });
        finalMessageId = `tg-dispatch-${Date.now()}`;
    }

    await persistDispatchResult({
        linea,
        dispatchPlatform,
        destPhone,
        finalMessage,
        sentAsImage,
        photoUrl,
        conductorId,
        finalMessageId,
        type,
        driver,
        client,
    });
}

async function sendWhatsappDispatch({
    linea,
    destPhone,
    finalMessage,
    sentAsImage,
    photoUrl,
    fallbackMessageId,
}: {
    linea: DispatchLine;
    destPhone: string;
    finalMessage: string;
    sentAsImage: boolean;
    photoUrl?: string;
    fallbackMessageId: string;
}) {
    const waUrl = `${WA_API_BASE}/${WA_API_VERSION}/${linea.phone_number_id}/messages`;
    const headers = {
        Authorization: `Bearer ${linea.access_token}`,
        'Content-Type': 'application/json',
    };

    let waPayload: Record<string, unknown>;
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
        throw new Error('Error al enviar el mensaje por WhatsApp');
    }

    const waData = await waResponse.json();
    return waData?.messages?.[0]?.id ?? fallbackMessageId;
}

async function sendTelegramDispatch({
    line_id,
    destPhone,
    finalMessage,
    mediaUrl,
    type,
}: {
    line_id: string;
    destPhone: string;
    finalMessage: string;
    mediaUrl: string | null;
    type: DispatchBody['type'];
}) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const tgResponse = await fetch(`${baseUrl}/internal/telegram/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            line_id,
            phone: destPhone,
            message: finalMessage,
            mediaUrl,
            type,
        }),
    });

    if (!tgResponse.ok) {
        const tgError = await tgResponse.json().catch(() => ({}));
        console.error('[dispatch-telegram] Error enviando por Telegram:', tgError);
        throw new Error('Error al enviar por Telegram');
    }
}

async function persistDispatchResult({
    linea,
    dispatchPlatform,
    destPhone,
    finalMessage,
    sentAsImage,
    photoUrl,
    conductorId,
    finalMessageId,
    type,
    driver,
    client,
}: {
    linea: DispatchLine;
    dispatchPlatform: 'whatsapp' | 'telegram';
    destPhone: string;
    finalMessage: string;
    sentAsImage: boolean;
    photoUrl?: string;
    conductorId?: mongoose.Types.ObjectId;
    finalMessageId: string;
    type: DispatchBody['type'];
    driver?: DispatchDriver;
    client?: DispatchClient;
}) {
    const lineaId = linea._id.toString();
    const now = new Date();

    const nuevoMensaje: IMessage = {
        _id: new mongoose.Types.ObjectId(),
        origen: 'sistema',
        texto: finalMessage,
        timestamp: now,
        leido: true,
        estado: 'enviado',
        tipo: sentAsImage && photoUrl ? 'image' : 'text',
        media_url: sentAsImage && photoUrl ? photoUrl : undefined,
        ...(dispatchPlatform === 'whatsapp' ? { wa_message_id: finalMessageId } : {}),
        ...(dispatchPlatform === 'telegram' ? { tg_peer_id: 'dispatch' } : {}),
    };

    const destinatarioNombre = type === 'dispatch_client' ? client?.name : driver?.name;
    let chat = await ChatsModel.findOne({ linea: lineaId, cliente_phone: destPhone, platform: dispatchPlatform });

    if (chat && chat.bloqueado) {
        console.log(`[dispatch-${dispatchPlatform}] Persistencia cancelada: usuario ${destPhone} marcado como EXENTO.`);
        return;
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

    const io = (global as { io?: import('socket.io').Server }).io;
    if (!io) return;

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

async function loadDispatchLine(lineId: string) {
    return LineasModel
        .findById(lineId)
        .select('+phone_number_id +access_token +telegram_api_id +isWhatsappConfigured +isTelegramConfigured')
        .lean<DispatchLine>();
}

function getDispatchPlatform(linea: DispatchLine): 'whatsapp' | 'telegram' {
    return linea.plataforma_despacho === 'telegram' ? 'telegram' : 'whatsapp';
}

function getPlatformConfigError(linea: DispatchLine, dispatchPlatform: 'whatsapp' | 'telegram') {
    const isWAConfigured = Boolean(linea.isWhatsappConfigured || (linea.phone_number_id && linea.access_token));
    const isTGConfigured = Boolean(linea.isTelegramConfigured || linea.telegram_api_id);

    if (dispatchPlatform === 'telegram' && !isTGConfigured) {
        return 'La línea no tiene Telegram configurado para despachos';
    }
    if (dispatchPlatform === 'whatsapp' && !isWAConfigured) {
        return 'La línea no tiene WhatsApp configurado para despachos';
    }

    return null;
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
    const p = phone.replace(/\D/g, '');
    let norm = p;
    if (p.startsWith('58')) norm = p.slice(2);
    else if (p.startsWith('0')) norm = p.slice(1);

    return [
        phone,
        norm,
        `0${norm}`,
        `58${norm}`,
        `+58${norm}`,
    ];
}
