import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
import LineasModel from '@/models/Lineas';
import { getGeminiReply } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { lineaId, chatId, senderId, wasReopened } = body;
        console.log(`[tg-ai-reply] << Recibida petición para chat=${chatId} linea=${lineaId}`);

        await connectDB();

        const linea = await LineasModel.findById(lineaId).select('+gemini_api_key +gemini_prompt').lean();
        if (!linea || !linea.gemini_api_key) {
             return NextResponse.json({ success: false, error: 'Linea sin IA' }, { status: 400 });
        }

        const chat = await ChatsModel.findById(chatId);
        if (!chat || chat.estado === 'en_atencion') {
            return NextResponse.json({ success: false, error: 'Chat no valido para IA' }, { status: 400 });
        }
        console.log(`[tg-ai-reply] Procesando IA para chat ${chatId}. Historia: ${chat.mensajes?.length} mensajes.`);
        const aiResult = await getGeminiReply({
            apiKey: linea.gemini_api_key,
            lineaName: linea.name,
            chatHistoria: chat.mensajes,
            clienteName: chat.cliente_nombre,
            customPrompt: linea.gemini_prompt
        });
        
        if (!aiResult) {
            console.error(`[tg-ai-reply] Gemini no devolvió resultado para chat ${chatId}`);
            return NextResponse.json({ success: false, error: 'Sin respuesta IA' }, { status: 400 });
        }

        console.log(`[tg-ai-reply] Gemini respondió. Text: "${aiResult.text?.substring(0, 30)}..." | Thinking: "${aiResult.thinking?.substring(0, 30)}..." | Handoff: ${aiResult.handoff} | NoResponse: ${aiResult.noResponse}`);

        const now = new Date();
        const io = (global as { io?: import('socket.io').Server }).io;

        // 1. Guardar pensamiento interno (si existe)
        if (aiResult.thinking) {
            const thinkingMessage = {
                _id: new mongoose.Types.ObjectId(),
                origen: 'sistema' as const,
                texto: aiResult.thinking,
                timestamp: new Date(now.getTime() - 1),
                leido: true,
                estado: 'entregado' as const,
                tipo: 'ai_thinking',
            };
            chat.mensajes.push(thinkingMessage as any);
            
            if (io) {
                io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', {
                    chatId,
                    mensaje: {
                        _id: thinkingMessage._id.toString(),
                        origen: thinkingMessage.origen,
                        texto: thinkingMessage.texto,
                        timestamp: thinkingMessage.timestamp.toISOString(),
                        tipo: 'ai_thinking',
                    },
                });
            }
        }

        // 2. Si la IA decidió que NO necesita responder
        if (aiResult.noResponse || !aiResult.text) {
            console.log(`[tg-ai-reply] No se requiere respuesta al cliente. Solo pensamiento guardado.`);
            await chat.save();
            return NextResponse.json({ success: true, mode: 'no-response' });
        }

        // 3. Enviar respuesta visible al cliente por Telegram
        const replyText = aiResult.text;
        const destPhone = chat.cliente_phone;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
        
        const tgResponse = await fetch(`${baseUrl}/internal/telegram/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                line_id: lineaId,
                phone: destPhone,
                message: replyText,
            }),
        });

        if (!tgResponse.ok) {
            console.error('[tg-ai-reply] Error enviando por Telegram', await tgResponse.json());
            await chat.save(); // Al menos guardamos el pensamiento si hubo
            return NextResponse.json({ success: false, error: 'Error Telegram' }, { status: 502 });
        }

        // 4. Guardar respuesta de la IA en la BD
        const aiMessage = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'sistema' as const,
            texto: replyText,
            timestamp: now,
            leido: true,
            estado: 'enviado' as const,
            tipo: 'text',
        };

        chat.mensajes.push(aiMessage as any);
        chat.ultimoMensaje = now;

        // 5. Transición de estado automática
        if (aiResult.handoff) {
            chat.estado = 'esperando_operador';
            console.log(`[tg-ai-reply] Handoff detectado → estado=esperando_operador`);
        } else if (chat.estado === 'pendiente' || wasReopened) {
            chat.estado = 'bot_atendiendo';
        }
        
        await chat.save();

        // 6. Emitir eventos finales por Socket.io
        if (io) {
            const mensajePayload = {
                _id: aiMessage._id.toString(),
                origen: aiMessage.origen,
                texto: aiMessage.texto,
                timestamp: now.toISOString(),
                leido: aiMessage.leido,
                estado: aiMessage.estado,
                tipo: aiMessage.tipo,
            };

            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });

            io.to(`chat:${chatId}`).emit('chat:estado_cambiado', { chatId, estado: chat.estado });
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', { chatId, estado: chat.estado });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[tg-ai-reply] Error:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
