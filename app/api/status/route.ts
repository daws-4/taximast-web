import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import LineasModel from '@/models/Lineas';

// GET /api/status — Verifica disponibilidad del backend (Omnicanal)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lineId = searchParams.get('line_id') || req.headers.get('X-Line-Id');

    // 1. Verificación básica de salud del servicio
    if (!lineId) {
        return NextResponse.json({
            connected: true,
            status: "online",
            service: "taximast-api-omnicanal",
            timestamp: new Date().toISOString(),
        });
    }

    // 2. Verificación específica de una línea
    try {
        await connectDB();

        const linea = await LineasModel.findById(lineId)
            .select('name activa isWhatsappConfigured isTelegramConfigured plataforma_despacho')
            .lean();

        if (!linea) {
            return NextResponse.json({
                connected: false,
                error: 'Línea no encontrada',
                timestamp: new Date().toISOString(),
            }, { status: 404 });
        }

        // Determinar si la plataforma configurada está lista
        const platform = linea.plataforma_despacho || 'whatsapp';
        const isReady = platform === 'telegram' ? linea.isTelegramConfigured : linea.isWhatsappConfigured;

        return NextResponse.json({
            connected: linea.activa !== false,
            status: linea.activa !== false ? "online" : "inactive",
            line_name: linea.name,
            platform: platform,
            platform_ready: isReady,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[api/status] Error:', error);
        return NextResponse.json({
            connected: false,
            error: 'Error interno del servidor',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
