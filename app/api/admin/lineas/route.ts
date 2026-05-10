import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import LineasModel from "@/models/Lineas";

// GET /api/admin/lineas — lista de líneas (admin global)
async function getHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    try {
        await connectDB();

        const { searchParams } = req.nextUrl;
        const soloActivas = searchParams.get("activas") === "true";

        const filtro = soloActivas ? { activa: true } : {};

        // Obtiene gemini_api_key para saber si existe, pero no la expone al cliente
        const lineas = await LineasModel.find(filtro)
            .select("-access_token -verify_token -phone_number_id -waba_id +gemini_api_key")
            .sort({ createdAt: -1 });

        // Transformar: reemplazar gemini_api_key por has_gemini_key (boolean) para seguridad
        const lineasSafe = lineas.map(l => {
            const obj = l.toObject() as unknown as Record<string, any>;
            obj.has_gemini_key = Boolean(obj.gemini_api_key);
            delete obj.gemini_api_key;
            return obj;
        });

        return NextResponse.json({ ok: true, data: lineasSafe });
    } catch (error) {
        console.error("[ADMIN/LINEAS GET] Error:", error);
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

// POST /api/admin/lineas — crear nueva línea con sus credenciales
async function postHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin") return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });

    try {
        await connectDB();

        const body = await req.json();
        const { name, whatsapp_number, phone_number_id, waba_id, access_token, verify_token, app_secret, gemini_api_key, gemini_prompt, telegram_api_id, telegram_api_hash, telegram_session, telegram_phone, plataforma_despacho } = body;

        if (!name) {
            return NextResponse.json(
                { ok: false, error: "El nombre de la línea es obligatorio" },
                { status: 400 }
            );
        }

        const linea = await LineasModel.create({
            name: name.trim(),
            whatsapp_number: whatsapp_number ? whatsapp_number.replace(/\D/g, "") : undefined,
            phone_number_id: phone_number_id?.trim() || undefined,
            waba_id: waba_id?.trim() || undefined,
            access_token: access_token?.trim() || undefined,
            verify_token: verify_token?.trim() || undefined,
            app_secret: app_secret?.trim() || undefined,
            gemini_api_key: gemini_api_key?.trim() || undefined,
            gemini_prompt: gemini_prompt?.trim() || undefined,
            telegram_api_id: telegram_api_id ? parseInt(telegram_api_id, 10) : undefined,
            telegram_api_hash: telegram_api_hash?.trim() || undefined,
            telegram_session: telegram_session?.trim() || undefined,
            telegram_phone: telegram_phone ? telegram_phone.replace(/\D/g, "") : undefined,
            isWhatsappConfigured: Boolean(whatsapp_number && phone_number_id && waba_id && access_token),
            isTelegramConfigured: Boolean(telegram_api_id && telegram_api_hash),
            plataforma_despacho: plataforma_despacho || 'whatsapp',
            activa: true,
        });

        // Devolver sin campos sensibles
        return NextResponse.json({
            ok: true,
            data: { _id: linea._id, name: linea.name, whatsapp_number: linea.whatsapp_number, activa: linea.activa },
        }, { status: 201 });
    } catch (error: any) {
        console.error("[ADMIN/LINEAS POST] Error:", error);
        if (error.code === 11000) {
            return NextResponse.json({ ok: false, error: "Ya existe una línea con ese número de WhatsApp" }, { status: 409 });
        }
        return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
