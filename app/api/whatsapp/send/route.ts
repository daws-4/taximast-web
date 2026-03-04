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
        const { phone, message, type = 'text', chatId } = body;

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
        } else if (type === 'image') {
            requestPayload.type = 'image';
            requestPayload.image = { link: message };
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

        // 4. Guardar el mensaje saliente en el chat
        const now = new Date();
        const nuevoMensaje = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'operador' as const,
            texto: message,
            timestamp: now,
            leido: true,
        };

        chat.mensajes.push(nuevoMensaje);
        chat.ultimoMensaje = now;
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
