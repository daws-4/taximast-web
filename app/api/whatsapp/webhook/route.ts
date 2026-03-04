import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
import LineasModel from '@/models/Lineas';

// ─── Verificación HMAC-SHA256 ─────────────────────────────────────────────────
function verifySignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret || !signature) return false;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
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
    // 1. Leer raw body para verificar firma
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (!verifySignature(rawBody, signature)) {
        console.warn('[webhook] Firma inválida rechazada');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Procesamos el webhook
    try {
        const body = JSON.parse(rawBody);
        // Esperar a que el proceso termine antes de responder
        // Meta nos da hasta 20 segundos. MongoDB tarda milisegundos.
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

    // Solo procesar eventos con mensajes
    if (!value?.messages?.length) return;

    const phoneNumberId: string = value.metadata?.phone_number_id;
    if (!phoneNumberId) return;

    await connectDB();

    // 2. Identificar la línea por phone_number_id
    const linea = await LineasModel
        .findOne({ phone_number_id: phoneNumberId })
        .select('+phone_number_id')
        .lean();

    if (!linea) {
        console.warn(`[webhook] Ninguna línea encontrada para phone_number_id=${phoneNumberId}`);
        return;
    }

    const lineaId = linea._id.toString();

    // 3. Procesar cada mensaje del batch
    for (const msg of value.messages) {
        // Ignorar mensajes enviados por nosotros mismos (Meta hace "eco")
        // Opcional: en status se podrían manejar el "delivered" o "read"
        if (msg?.from === linea.whatsapp_number) continue;

        const clientePhone: string = msg.from; // E.164 sin "+"
        const texto = extractText(msg);
        const timestamp = new Date(parseInt(msg.timestamp, 10) * 1000);

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
        };

        const { doc: chat, isNew } = await upsertChat({
            lineaId,
            clientePhone,
            clienteNombre,
            mensaje: nuevoMensaje,
        });

        if (!chat) continue;

        const chatId = chat._id.toString();

        // 6. Emitir eventos Socket.io
        const io = (global as { io?: import('socket.io').Server }).io;
        if (io) {
            if (isNew) {
                // Si es un chat totalmente nuevo, solo avisamos a las listas para que lo agreguen al menú.
                // No emitimos 'nuevo_mensaje' porque cuando el admin haga clic, el frontend 
                // bajará la base de datos completa con el fetch initial.
                io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_chat', {
                    _id: chatId,
                    linea: { _id: lineaId, name: linea.name },
                    cliente_phone: clientePhone,
                    cliente_nombre: clienteNombre,
                    estado: 'pendiente',
                    ultimoMensaje: timestamp.toISOString(),
                });
            } else {
                // Si el chat ya existía y estaba abierto, emitimos a la sala específica para inyectar la burbuja
                io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', {
                    chatId,
                    mensaje: {
                        _id: nuevoMensaje._id.toString(), // ID consistente de MongoDB
                        origen: nuevoMensaje.origen,
                        texto: nuevoMensaje.texto,
                        timestamp: nuevoMensaje.timestamp.toISOString(),
                        leido: nuevoMensaje.leido,
                    },
                });

                // Actualizar ultimoMensaje en la vista de lista de la izquierda
                io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', {
                    chatId,
                    mensaje: {
                        _id: nuevoMensaje._id.toString(), // Faltaba el ID! Esto causaba duplicidad en el frontend
                        origen: nuevoMensaje.origen,
                        texto: nuevoMensaje.texto,
                        timestamp: nuevoMensaje.timestamp.toISOString(),
                        leido: nuevoMensaje.leido,
                    },
                });
            }
        }

        console.log(`[webhook] Mensaje guardado — chat=${chatId} linea=${lineaId} from=${clientePhone}`);
    }
}

// ─── Upsert del chat ──────────────────────────────────────────────────────────
interface UpsertChatArgs {
    lineaId: string;
    clientePhone: string;
    clienteNombre?: string;
    mensaje: {
        _id: mongoose.Types.ObjectId;
        origen: 'cliente' | 'operador' | 'sistema';
        texto: string;
        timestamp: Date;
        leido: boolean;
    };
}

async function upsertChat({ lineaId, clientePhone, clienteNombre, mensaje }: UpsertChatArgs) {
    const now = mensaje.timestamp;

    // Intentar buscar el chat existente primero
    let isNew = false;
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
        await chat.save();
    }

    return { doc: chat, isNew };
}
