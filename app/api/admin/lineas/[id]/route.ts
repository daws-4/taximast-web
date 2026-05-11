import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import LineasModel from "@/models/Lineas";
import OperadorModel from "@/models/Operadores";

// PATCH /api/admin/lineas/[id] — editar línea (requiere validar Meta API p/ tokens)
async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user || user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;
        const body = await req.json();

        const linea = await LineasModel.findById(id);
        if (!linea) return NextResponse.json({ ok: false, error: "Línea no encontrada" }, { status: 404 });

        // Si se están actualizando las credenciales, primero validar con Meta
        const hasId = body.phone_number_id?.trim();
        const hasToken = body.access_token?.trim();

        if (hasId || hasToken) {
            const checkId = hasId || linea.phone_number_id;
            const checkToken = hasToken || linea.access_token;

            try {
                // Probamos traer el perfil para validar permisos
                const metaRes = await fetch(`https://graph.facebook.com/v20.0/${checkId}/whatsapp_business_profile?fields=name,profile_picture_url`, {
                    headers: { "Authorization": `Bearer ${checkToken}` }
                });

                const metaData = await metaRes.json();

                if (!metaRes.ok || metaData.error) {
                    return NextResponse.json({
                        ok: false,
                        error: metaData.error?.message || "Credenciales de Meta inválidas verificando el token/ID."
                    }, { status: 400 });
                }
            } catch (err) {
                console.error("[META VALIDATION ERROR]", err);
                return NextResponse.json({ ok: false, error: "La conexión con la API de Meta falló al validar credenciales." }, { status: 500 });
            }
        }

        // Actualizar datos
        if (body.name !== undefined) linea.name = body.name.trim();
        if (body.whatsapp_number !== undefined) linea.whatsapp_number = body.whatsapp_number.replace(/\D/g, "");
        if (body.phone_number_id !== undefined) linea.phone_number_id = body.phone_number_id.trim();
        if (body.waba_id !== undefined) linea.waba_id = body.waba_id.trim();
        if (body.access_token !== undefined) linea.access_token = body.access_token.trim();
        if (body.verify_token !== undefined) linea.verify_token = body.verify_token.trim();
        if (body.app_secret !== undefined) linea.app_secret = body.app_secret.trim();
        if (body.gemini_api_key !== undefined) linea.gemini_api_key = body.gemini_api_key.trim();
        if (body.gemini_prompt !== undefined) linea.gemini_prompt = body.gemini_prompt.trim();
        if (body.telegram_api_id !== undefined) {
            linea.telegram_api_id = body.telegram_api_id ? parseInt(body.telegram_api_id, 10) : undefined;
        }
        if (body.telegram_api_hash !== undefined) linea.telegram_api_hash = body.telegram_api_hash.trim();
        if (body.telegram_session !== undefined) linea.telegram_session = body.telegram_session.trim();
        if (body.telegram_phone !== undefined) linea.telegram_phone = body.telegram_phone.replace(/\D/g, "");
        if (body.plataforma_despacho !== undefined) linea.plataforma_despacho = body.plataforma_despacho;
        if (body.activa !== undefined) linea.activa = body.activa;
        if (body.ia_activa !== undefined) (linea as any).ia_activa = body.ia_activa;

        // Recalcular flags de configuración
        linea.isWhatsappConfigured = Boolean(linea.whatsapp_number && linea.phone_number_id && linea.waba_id && linea.access_token);
        linea.isTelegramConfigured = Boolean(linea.telegram_api_id && linea.telegram_api_hash);

        console.log("Guardando línea con datos:", {
            telegram_api_id: linea.telegram_api_id,
            telegram_phone: linea.telegram_phone,
            modifiedPaths: linea.modifiedPaths()
        });

        console.log("Schema paths en Next.js:", Object.keys(LineasModel.schema.paths).filter(p => p.startsWith('telegram')));

        await linea.save();

        // Notificar al motor de Telegram si la línea tiene Telegram configurado
        if (linea.isTelegramConfigured) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            fetch(`${baseUrl}/internal/telegram/reload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ line_id: id })
            }).catch(err => console.error("[LINEA-RELOAD] Error notificando al motor:", err));
        }

        return NextResponse.json({ ok: true, data: { _id: linea._id, name: linea.name } });
    } catch (error: any) {
        console.error("[ADMIN/LINEAS PATCH] Error:", error);
        if (error.code === 11000) return NextResponse.json({ ok: false, error: "Ya existe una línea con ese WhatsApp" }, { status: 409 });
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// DELETE /api/admin/lineas/[id] — eliminar línea
async function deleteHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = getUserFromRequest(req);
    if (!user || user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;

        // Comprobar si hay operadores asignados
        const operadoresCount = await OperadorModel.countDocuments({ linea: id });
        if (operadoresCount > 0) {
            return NextResponse.json({ ok: false, error: `No se puede eliminar la línea porque tiene ${operadoresCount} operador(es) asignado(s). Elimínelos o reasígnelos primero.` }, { status: 400 });
        }

        const linea = await LineasModel.findByIdAndDelete(id);
        if (!linea) return NextResponse.json({ ok: false, error: "Línea no encontrada" }, { status: 404 });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[ADMIN/LINEAS DELETE] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
