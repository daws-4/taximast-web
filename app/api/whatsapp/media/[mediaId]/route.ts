import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import LineasModel from '@/models/Lineas';

// GET /api/whatsapp/media/[mediaId]?lineaId=XYZ
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ mediaId: string }> }
) {
    const { mediaId } = await params;
    const { searchParams } = new URL(req.url);
    const lineaId = searchParams.get('lineaId');

    if (!lineaId || !mediaId) {
        return new NextResponse('Bad Request', { status: 400 });
    }

    try {
        await connectDB();
        const linea = await LineasModel.findById(lineaId).select('+access_token').lean();
        if (!linea) {
            return new NextResponse('Línea no encontrada', { status: 404 });
        }

        // 1. Consultar Metadatos del Archivo Multimedia en Graph API
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: {
                Authorization: `Bearer ${linea.access_token}`
            }
        });
        
        if (!metaRes.ok) {
            console.error('[media] MetaData Fetch Error:', await metaRes.text());
            return new NextResponse('Error fetching media metadata', { status: 502 });
        }
        
        const metaData = await metaRes.json();
        const urlOptions = metaData.url;
        const mimeType = metaData.mime_type;
        
        if (!urlOptions) {
            return new NextResponse('No CDN URL found in Meta response', { status: 404 });
        }

        // 2. Descargar el archivo binario usando la URL segura del CDN
        const mediaRes = await fetch(urlOptions, {
            headers: {
                Authorization: `Bearer ${linea.access_token}`
            }
        });

        if (!mediaRes.ok) {
            console.error('[media] Binary Fetch Error:', await mediaRes.text());
            return new NextResponse('Error fetching media binary', { status: 502 });
        }

        const buffer = await mediaRes.arrayBuffer();

        // 3. Servir el buffer proxyando al frontend con el mime_type original
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': mimeType || 'application/octet-stream',
                'Cache-Control': 'public, max-age=31536000, immutable' // Caché robusto para no machacar la API
            }
        });
    } catch (error) {
        console.error('[media] Internal Proxy error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
