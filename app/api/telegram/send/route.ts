import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
import { withAuth, getUserFromRequest } from '@/lib/auth';

// POST /api/telegram/send
async function sendHandler(req: NextRequest) {
    try {
        // 0. Validar Auth: Puede ser por API KEY (VFP) o por Sesión (Web)
        const user = getUserFromRequest(req);
        if (!user) {
            const authError = validateApiKey(req);
            if (authError) return authError;
        }

        const body = await req.json();
        const { phone, message, type = 'text', chatId, localId } = body;

        if (!phone || !message || !chatId) {
            console.warn('[tg-send] Faltan campos requeridos:', { phone, message, chatId });
            return NextResponse.json(
                { success: false, error: 'Se requieren phone, message y chatId' },
                { status: 400 }
            );
        }

        console.log(`[tg-send] Procesando envío a ${phone} para chat ${chatId}`);

        await connectDB();

        const chat = await ChatsModel.findById(chatId);
        if (!chat) {
            return NextResponse.json({ success: false, error: 'Chat no encontrado' }, { status: 404 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const tgResponse = await fetch(`${baseUrl}/internal/telegram/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                line_id: chat.linea.toString(),
                phone: phone,
                message: message,
            }),
        });

        console.log(`[tg-send] Respuesta del motor interno: ${tgResponse.status}`);

        if (!tgResponse.ok) {
            const tgError = await tgResponse.json().catch(() => ({}));
            console.error('[tg-send] Error enviando por Telegram:', tgError);
            return NextResponse.json(
                { success: false, error: 'Error al enviar por Telegram', detail: tgError },
                { status: 502 }
            );
        }

        const messageId = `tg-sent-${Date.now()}`;

        const now = new Date();
        const nuevoMensaje = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'operador' as const,
            texto: message,
            timestamp: now,
            leido: true,
            estado: 'enviado' as const,
            tg_peer_id: 'operador',
            tipo: 'text',
        };

        chat.mensajes.push(nuevoMensaje as any);
        chat.ultimoMensaje = now;
        
        if (chat.estado !== 'en_atencion' && chat.estado !== 'cerrado') {
            chat.estado = 'en_atencion';
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

        const io = (global as { io?: import('socket.io').Server }).io;
        if (io) {
            const lineaId = chat.linea.toString();
            const mensajePayload = {
                _id: nuevoMensaje._id.toString(),
                localId: localId,
                origen: nuevoMensaje.origen,
                texto: nuevoMensaje.texto,
                timestamp: now.toISOString(),
                leido: nuevoMensaje.leido,
                estado: nuevoMensaje.estado,
                tipo: nuevoMensaje.tipo,
            };

            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
        }

        return NextResponse.json({ success: true, messageId });
    } catch (error) {
        console.error('[tg-send] Error interno:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

export const POST = withAuth(sendHandler);
