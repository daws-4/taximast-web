import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import LineasModel from "@/models/Lineas";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Set fluent-ffmpeg to use the static binary
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

async function convertWebmToOgg(buffer: Uint8Array): Promise<Buffer> {
    const tempIn = join(tmpdir(), `in_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`);
    const tempOut = join(tmpdir(), `out_${Date.now()}_${Math.random().toString(36).substring(7)}.ogg`);
    
    await writeFile(tempIn, buffer);
    
    return new Promise((resolve, reject) => {
        ffmpeg(tempIn)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('end', async () => {
                try {
                    const { readFile } = await import('fs/promises');
                    const outBuffer = await readFile(tempOut);
                    // Cleanup
                    await unlink(tempIn).catch(() => {});
                    await unlink(tempOut).catch(() => {});
                    resolve(outBuffer);
                } catch (e) {
                    reject(e);
                }
            })
            .on('error', async (err) => {
                await unlink(tempIn).catch(() => {});
                reject(err);
            })
            .save(tempOut);
    });
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        let file = formData.get("file") as File;
        const lineaId = formData.get("lineaId") as string;
        
        if (!file || !lineaId) {
            return NextResponse.json({ success: false, error: "Faltan datos requeridos (file o lineaId)" }, { status: 400 });
        }

        // Si el archivo es un webm de audio de nuestro grabador, lo convertimos a OGG/Opus
        if (file.type === "audio/webm" || file.type.includes("audio/webm;codecs=opus")) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                const oggBuffer = await convertWebmToOgg(buffer);
                // Reemplazamos el File original con el OGG convertido
                file = new File([new Uint8Array(oggBuffer)], "audio.ogg", { type: "audio/ogg" });
            } catch (err) {
                console.error("[upload] Error convirtiendo audio:", err);
                // Si falla, intentamos enviarlo tal cual
            }
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
