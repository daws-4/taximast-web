import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import ChatsModel from '@/models/Chats';
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
    // image se ignora intencionalmente
}

// ── POST /api/whatsapp/dispatch ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body: DispatchBody = await req.json();
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
        let photoUrl: string | undefined = undefined;
        let conductorId: mongoose.Types.ObjectId | undefined = undefined;

        // 4. Según el tipo, decidir cómo enviar
        let finalMessage = message;
        
        if (type === 'dispatch_driver') {
            // Eliminar cualquier enlace de Google Maps y la " A " ocasional que lo precede
            finalMessage = finalMessage.replace(/\s*(?:A\s+)?https?:\/\/(?:www\.)?(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)[^\s]*/gi, '').trim();
        }

        if (type === 'dispatch_client') {
            // Extraer el teléfono del conductor directamente del objeto 'conductor' si FoxPro lo incluyó
            let targetDriverPhone = conductor?.numero || conductor?.phone || driver?.phone;
            
            // Fallback al string del mensaje si no viene en las propiedades estructuradas
            if (!targetDriverPhone) {
                const choferMatch = message.match(/CHOFER:\s*(\d+)/i);
                if (choferMatch && choferMatch[1]) {
                    targetDriverPhone = choferMatch[1];
                }
            }

            console.log(`[dispatch] dispatch_client: targetDriverPhone extraido=${targetDriverPhone}`);

            if (targetDriverPhone) {
                // 4.1 Intentar obtener la foto desde la base de datos (MongoDB) primero
                const driverPhoneVariants = getPhoneVariants(targetDriverPhone);
                const conductorRecord = await ConductoresModel.findOne({
                    telefono: { $in: driverPhoneVariants },
                    linea: linea._id,
                }).lean();

                if (conductorRecord) {
                    console.log(`[dispatch] Conductor encontrado en BD: ${conductorRecord._id}`);
                    conductorId = conductorRecord._id as mongoose.Types.ObjectId;
                    photoUrl = conductorRecord.foto_identificacion;
                } else {
                    console.log(`[dispatch] NO se encontro conductor en BD para telefonos:`, driverPhoneVariants);
                }

                // 4.2 Si no hay foto en MongoDB, intentar el helper de PocketBase
                if (!photoUrl) {
                    const pbPhoto = await getDriverPhotoUrl(targetDriverPhone);
                    if (pbPhoto) photoUrl = pbPhoto;
                }

                if (photoUrl) {
                    // Enviar imagen del chófer al cliente con caption
                    waPayload = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: destPhone,
                        type: 'image',
                        image: {
                            link: photoUrl,
                            caption: finalMessage,
                        },
                    };
                    sentAsImage = true;
                } else {
                    // Sin foto → enviar solo texto
                    console.log(`[dispatch] No se encontró foto para chófer ${targetDriverPhone}, enviando solo texto`);
                    waPayload = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: destPhone,
                        type: 'text',
                        text: { preview_url: false, body: finalMessage },
                    };
                }
            } else {
                console.log(`[dispatch] No se detectó número de chófer en el mensaje, enviando solo texto al cliente`);
                waPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: destPhone,
                    type: 'text',
                    text: { preview_url: false, body: finalMessage },
                };
            }
        } else {
            // dispatch_driver o general → solo texto (NUNCA ubicación ni imagen a conductores)
            waPayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: destPhone,
                type: 'text',
                text: { preview_url: false, body: finalMessage },
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
            texto: finalMessage, // Utilizamos el finalMessage sin el link de maps
            timestamp: now,
            leido: true,
            estado: 'enviado' as const,
            wa_message_id,
            tipo: sentAsImage ? 'image' : 'text',
            ...(sentAsImage && photoUrl ? { media_url: photoUrl } : {})
        };

        // Determinar nombre del destinatario
        const destinatarioNombre = type === 'dispatch_client'
            ? client?.name
            : driver?.name;

        // Buscar el conductor en la BD por teléfono si es dispatch_driver
        if (type === 'dispatch_driver' && phone) {
            const driverPhoneVariants = getPhoneVariants(phone);
            const conductorQuery = await ConductoresModel.findOne({
                telefono: { $in: driverPhoneVariants },
                linea: linea._id,
            }).lean();
            if (conductorQuery) {
                conductorId = conductorQuery._id as mongoose.Types.ObjectId;
            }
        }

        // Buscar o crear chat
        let chat = await ChatsModel.findOne({ linea: lineaId, cliente_phone: destPhone });
        const isNewChat = !chat;

        if (!chat) {
            chat = await ChatsModel.create({
                linea: lineaId,
                cliente_phone: destPhone,
                cliente_nombre: destinatarioNombre,
                tipo_chat: type === 'dispatch_driver' ? 'conductor' : 'cliente',
                conductor: conductorId,
                estado: type === 'dispatch_client' ? 'cerrado' : 'en_atencion',
                mensajes: [nuevoMensaje],
                ultimoMensaje: now,
            });
        } else {
            chat.mensajes.push(nuevoMensaje as any);
            chat.ultimoMensaje = now;
            if (destinatarioNombre && !chat.cliente_nombre) {
                chat.cliente_nombre = destinatarioNombre;
            }
            // Vincular conductor si no estaba vinculado
            if (conductorId && !chat.conductor) {
                chat.conductor = conductorId;
                if (type === 'dispatch_driver') chat.tipo_chat = 'conductor';
            }
            // Cerrar chat del cliente cuando se le envía info del conductor
            if (type === 'dispatch_client') {
                chat.estado = 'cerrado';
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
                media_url: nuevoMensaje.media_url,
            };

            io.to(`chat:${chatId}`).emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });
            io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:nuevo_mensaje', { chatId, mensaje: mensajePayload });

            // Si es un chat nuevo, emitir evento para que aparezca en la lista del sidebar
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
                        ultimoMensaje: chatPopulated.ultimoMensaje,
                    });
                }
            }

            // Si se cerró el chat, emitir evento de cambio de estado
            if (type === 'dispatch_client') {
                io.to(`chat:${chatId}`).emit('chat:estado_cambiado', { chatId, estado: 'cerrado' });
                io.to(`linea:${lineaId}`).to('linea:admin').emit('chat:estado_cambiado', { chatId, estado: 'cerrado' });
            }
        }

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
    
    // norm is now e.g. "4241234567"
    return [
        phone,       // format that was passed in
        norm,        // 4241234567
        `0${norm}`,  // 04241234567
        `58${norm}`, // 584241234567
    ];
}
