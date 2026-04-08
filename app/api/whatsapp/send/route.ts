import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
import LineasModel from '@/models/Lineas';

const WA_API_VERSION = 'v21.0';
const WA_API_BASE = 'https://graph.facebook.com';

// POST /api/whatsapp/send
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone, message, type = 'text', chatId, caption } = body;

        if (!phone || !message || !chatId) {
            return NextResponse.json(
                { success: false, error: 'Se requieren phone, message y chatId' },
                { status: 400 }
            );
        }

        await connectDB();

        // 1. Cargar el chat para obtener la línea
        const chat = await ChatsModel.findById(chatId);
        if (!chat) {
            return NextResponse.json({ success: false, error: 'Chat no encontrado' }, { status: 404 });
        }

        // 2. Cargar la línea con los campos privados (select: false)
        const linea = await LineasModel
            .findById(chat.linea)
            .select('+phone_number_id +access_token')
            .lean();

        if (!linea) {
            return NextResponse.json({ success: false, error: 'Línea no encontrada' }, { status: 404 });
        }

        // 3. Llamar a la Cloud API de WhatsApp
        const url = `${WA_API_BASE}/${WA_API_VERSION}/${linea.phone_number_id}/messages`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestPayload: Record<string, any> = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
        };

        if (type === 'text') {
            requestPayload.type = 'text';
            requestPayload.text = { preview_url: false, body: message };
        } else if (type === 'image' || type === 'document' || type === 'video' || type === 'audio' || type === 'sticker') {
            requestPayload.type = type;
            if (caption && (type === 'image' || type === 'video' || type === 'document')) {
                requestPayload[type] = { id: message, caption };
            } else {
                requestPayload[type] = { id: message };
            }
        } else {
            // Tipo desconocido — enviar como texto
            requestPayload.type = 'text';
            requestPayload.text = { preview_url: false, body: message };
        }

        const waResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${linea.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
        });

        if (!waResponse.ok) {
            const waError = await waResponse.json().catch(() => ({}));
            console.error('[send] Error de WhatsApp API:', waError);
            return NextResponse.json(
                { success: false, error: 'Error al enviar el mensaje por WhatsApp', detail: waError },
                { status: 502 }
            );
        }

        const waData = await waResponse.json();
        const messageId: string = waData?.messages?.[0]?.id ?? `sent-${Date.now()}`;

        const isMediaOut = type !== 'text';
        const generatedMediaUrl = isMediaOut ? `/api/whatsapp/media/${message}?lineaId=${chat.linea.toString()}` : undefined;

        // 4. Guardar el mensaje saliente en el chat
        const now = new Date();
        const textoFaltante = type === "audio" ? "[Audio]" : type === "sticker" ? "[Sticker]" : type === "image" ? "[Imagen]" : type === "video" ? "[Video]" : "[Documento]";
        const nuevoMensaje = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'operador' as const,
            texto: isMediaOut ? (caption || textoFaltante) : message,
            timestamp: now,
            leido: true, // El operador lee su propio mensaje
            estado: 'enviado' as const,
            wa_message_id: messageId !== `sent-${now.getTime()}` /* just fallback */ ? messageId : undefined,
            tipo: type,
            media_url: generatedMediaUrl
        };

        chat.mensajes.push(nuevoMensaje as any);
        chat.ultimoMensaje = now;
        // Cuando un operador responde, tomar control del chat automáticamente
        if (chat.estado !== 'en_atencion' && chat.estado !== 'cerrado') {
            chat.estado = 'en_atencion';
            // Notificar cambio de estado por Socket
            const ioRef = (global as { io?: import('socket.io').Server }).io;
            if (ioRef) {
                const lineaIdStr = chat.linea.toString();
                ioRef.to(`linea:${lineaIdStr}`).to('linea:admin').emit('chat:estado_cambiado', {
                    chatId,
                    estado: 'en_atencion',
                });
            }
        }
        await chat.save();

        // 5. Emitir evento Socket.io
        const io = (global as { io?: import('socket.io').Server }).io;
        if (io) {
            const lineaId = chat.linea.toString();
            const mensajePayload = {
                _id: nuevoMensaje._id.toString(), // Mismo ID que MongoDB
                origen: nuevoMensaje.origen,
                texto: nuevoMensaje.texto,
                timestamp: now.toISOString(),
                leido: nuevoMensaje.leido,
                estado: nuevoMensaje.estado,
                tipo: nuevoMensaje.tipo,
                media_url: nuevoMensaje.media_url
            };

            // Al panel de conversación abierto
            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
            // A la lista de chats para actualizar el timestamp
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
        }

        return NextResponse.json({ success: true, messageId });
    } catch (error) {
        console.error('[send] Error interno:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
