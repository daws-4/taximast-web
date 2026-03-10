import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
import LineasModel from '@/models/Lineas';
import { getDriverPhotoUrl } from '@/lib/pocketbase';

const WA_API_VERSION = 'v21.0';
const WA_API_BASE = 'https://graph.facebook.com';

// ── Interfaces del payload de FoxPro ────────────────────────────────────────
interface DispatchDriver {
    phone: string;
    name: string;
    unit?: string;
}

interface DispatchClient {
    phone: string;
    name?: string;
    address?: string;
}

interface DispatchBody {
    line_id: string;
    line_name?: string;
    phone: string;
    message: string;
    type: 'dispatch_driver' | 'dispatch_client' | 'general';
    driver?: DispatchDriver;
    client?: DispatchClient;
    // image se ignora intencionalmente
}

// ── POST /api/whatsapp/dispatch ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body: DispatchBody = await req.json();
        const { line_id, phone, message, type = 'general', driver, client } = body;

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
            .select('+phone_number_id +access_token')
            .lean();

        if (!linea) {
            return NextResponse.json(
                { success: false, error: 'Línea no encontrada' },
                { status: 404 }
            );
        }

        if (linea.activa === false) {
            return NextResponse.json(
                { success: false, error: 'La línea está inactiva' },
                { status: 403 }
            );
        }

        // 3. Construir el payload para WhatsApp Cloud API
        const waUrl = `${WA_API_BASE}/${WA_API_VERSION}/${linea.phone_number_id}/messages`;
        const headers = {
            'Authorization': `Bearer ${linea.access_token}`,
            'Content-Type': 'application/json',
        };

        // Normalizar el teléfono destino (quitar 0 inicial, agregar 58 si es venezolano)
        const destPhone = normalizePhoneForWA(phone);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let waPayload: Record<string, any>;
        let sentAsImage = false;

        // 4. Según el tipo, decidir cómo enviar
        if (type === 'dispatch_client' && driver?.phone) {
            // Intentar obtener la foto del chófer desde PocketBase
            const photoUrl = await getDriverPhotoUrl(driver.phone);

            if (photoUrl) {
                // Enviar imagen con caption
                waPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: destPhone,
                    type: 'image',
                    image: {
                        link: photoUrl,
                        caption: message,
                    },
                };
                sentAsImage = true;
            } else {
                // Sin foto → enviar solo texto
                console.log(`[dispatch] No se encontró foto para chófer ${driver.phone}, enviando solo texto`);
                waPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: destPhone,
                    type: 'text',
                    text: { preview_url: false, body: message },
                };
            }
        } else {
            // dispatch_driver o general → solo texto
            waPayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: destPhone,
                type: 'text',
                text: { preview_url: false, body: message },
            };
        }

        // 5. Enviar a WhatsApp
        const waResponse = await fetch(waUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(waPayload),
        });

        if (!waResponse.ok) {
            const waError = await waResponse.json().catch(() => ({}));
            console.error('[dispatch] Error de WhatsApp API:', waError);
            return NextResponse.json(
                { success: false, error: 'Error al enviar el mensaje por WhatsApp', detail: waError },
                { status: 502 }
            );
        }

        const waData = await waResponse.json();
        const wa_message_id: string = waData?.messages?.[0]?.id ?? `dispatch-${Date.now()}`;

        // 6. Registrar en la base de datos (upsert del chat)
        const lineaId = linea._id.toString();
        const now = new Date();

        const nuevoMensaje = {
            _id: new mongoose.Types.ObjectId(),
            origen: 'sistema' as const,
            texto: message,
            timestamp: now,
            leido: true,
            estado: 'enviado' as const,
            wa_message_id,
            tipo: sentAsImage ? 'image' : 'text',
        };

        // Determinar nombre del destinatario
        const destinatarioNombre = type === 'dispatch_client'
            ? client?.name
            : driver?.name;

        // Buscar o crear chat
        let chat = await ChatsModel.findOne({ linea: lineaId, cliente_phone: destPhone });

        if (!chat) {
            chat = await ChatsModel.create({
                linea: lineaId,
                cliente_phone: destPhone,
                cliente_nombre: destinatarioNombre,
                tipo_chat: type === 'dispatch_driver' ? 'conductor' : 'cliente',
                estado: 'en_atencion',
                mensajes: [nuevoMensaje],
                ultimoMensaje: now,
            });
        } else {
            chat.mensajes.push(nuevoMensaje as any);
            chat.ultimoMensaje = now;
            if (destinatarioNombre && !chat.cliente_nombre) {
                chat.cliente_nombre = destinatarioNombre;
            }
            await chat.save();
        }

        // 7. Emitir Socket.io para panel web
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
            };

            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
        }

        console.log(`[dispatch] Mensaje enviado — type=${type} to=${destPhone} wa_id=${wa_message_id} image=${sentAsImage}`);

        return NextResponse.json({ success: true, messageId: wa_message_id });
    } catch (error) {
        console.error('[dispatch] Error interno:', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}

// ── Normalización del teléfono para WhatsApp ────────────────────────────────
// FoxPro envía "04121234567", WhatsApp necesita "584121234567"
function normalizePhoneForWA(phone: string): string {
    let p = phone.replace(/\D/g, '');
    // Si empieza con 0, reemplazar por 58 (código de Venezuela)
    if (p.startsWith('0')) {
        p = '58' + p.slice(1);
    }
    // Si no tiene código de país, asumir 58
    if (p.length === 10) {
        p = '58' + p;
    }
    return p;
}
