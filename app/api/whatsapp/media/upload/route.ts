import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import LineasModel from "@/models/Lineas";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const lineaId = formData.get("lineaId") as string;
        
        if (!file || !lineaId) {
            return NextResponse.json({ success: false, error: "Faltan datos requeridos (file o lineaId)" }, { status: 400 });
        }

        await connectDB();
        
        // 1. Obtener los tokens de la línea
        const linea = await LineasModel.findById(lineaId).select("+phone_number_id +access_token").lean();
        
        if (!linea) {
            return NextResponse.json({ success: false, error: "Línea no encontrada" }, { status: 404 });
        }

        // 2. Preparar el payload de multipart/form-data para Meta
        const metaFormData = new FormData();
        metaFormData.append("file", file);
        metaFormData.append("messaging_product", "whatsapp");

        // 3. Subir el archivo temporalmente al CDN de Meta
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${linea.phone_number_id}/media`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${linea.access_token}`
                // Let FormData set the Content-Type boundary automatically
            },
            body: metaFormData
        });

        if (!metaRes.ok) {
            const errorText = await metaRes.text();
            console.error("[upload] Meta API Error subiendo media:", errorText);
            return NextResponse.json({ success: false, error: "Rechazado por Meta API" }, { status: 502 });
        }

        const data = await metaRes.json();
        const mediaId = data.id;

        if (!mediaId) {
            return NextResponse.json({ success: false, error: "Meta no devolvió un ID de medio." }, { status: 500 });
        }

        // 4. Retornar el Media ID generado a nuestro frontend para ser consumido
        return NextResponse.json({ success: true, mediaId });
    } catch (error) {
        console.error("[upload] Error interno del servidor:", error);
        return NextResponse.json({ success: false, error: "Error de proxy interno" }, { status: 500 });
    }
}
