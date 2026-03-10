import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import LineasModel from '@/models/Lineas';

// GET /api/whatsapp/status — verifica disponibilidad del backend
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lineId = searchParams.get('line_id');

    // Si no se pasa line_id, simplemente confirmar que el servicio está vivo
    if (!lineId) {
        return NextResponse.json({
            connected: true,
            service: "whatsapp-business-api",
            timestamp: new Date().toISOString(),
        });
    }

    // Si se pasa line_id, verificar que la línea existe y está activa
    try {
        await connectDB();

        const linea = await LineasModel.findById(lineId).select('name activa').lean();

        if (!linea) {
            return NextResponse.json({
                connected: false,
                error: 'Línea no encontrada',
                timestamp: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            connected: linea.activa !== false,
            service: "whatsapp-business-api",
            line_name: linea.name,
            line_active: linea.activa,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[status] Error:', error);
        return NextResponse.json({
            connected: false,
            error: 'Error verificando línea',
            timestamp: new Date().toISOString(),
        });
    }
}
