import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import LineasModel from '@/models/Lineas';

const WA_API_VERSION = 'v21.0';
const WA_API_BASE = 'https://graph.facebook.com';

interface BulkMessage {
    phone: string;
    message: string;
}

interface BulkBody {
    line_id: string;
    line_name?: string;
    messages: BulkMessage[];
    type?: string;
}

// POST /api/whatsapp/dispatch-bulk — envío masivo desde el desktop
export async function POST(req: NextRequest) {
    try {
        const body: BulkBody = await req.json();
        const { line_id, messages } = body;

        if (!line_id || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { success: false, error: "Se requieren line_id y un array 'messages' no vacío" },
                { status: 400 }
            );
        }

        await connectDB();

        // Buscar línea con credenciales
        const linea = await LineasModel
            .findById(line_id)
            .select('+phone_number_id +access_token')
            .lean();

        if (!linea) {
            return NextResponse.json({ success: false, error: 'Línea no encontrada' }, { status: 404 });
        }

        if (linea.activa === false) {
            return NextResponse.json({ success: false, error: 'La línea está inactiva' }, { status: 403 });
        }

        const waUrl = `${WA_API_BASE}/${WA_API_VERSION}/${linea.phone_number_id}/messages`;
        const headers = {
            'Authorization': `Bearer ${linea.access_token}`,
            'Content-Type': 'application/json',
        };

        let sent = 0;
        let failed = 0;

        for (const msg of messages) {
            if (!msg.phone || !msg.message) {
                failed++;
                continue;
            }

            const destPhone = normalizePhoneForWA(msg.phone);

            try {
                const waPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: destPhone,
                    type: 'text',
                    text: { preview_url: false, body: msg.message },
                };

                const res = await fetch(waUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(waPayload),
                });

                if (res.ok) {
                    sent++;
                } else {
                    console.error(`[dispatch-bulk] Error enviando a ${destPhone}:`, await res.text());
                    failed++;
                }
            } catch (err) {
                console.error(`[dispatch-bulk] Error de red enviando a ${destPhone}:`, err);
                failed++;
            }
        }

        console.log(`[dispatch-bulk] Completado: ${sent} enviados, ${failed} fallidos`);

        return NextResponse.json({ success: true, sent, failed });
    } catch (error) {
        console.error('[dispatch-bulk] Error interno:', error);
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
