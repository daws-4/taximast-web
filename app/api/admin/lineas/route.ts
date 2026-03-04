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

        // Excluye tokens sensibles del listado
        const lineas = await LineasModel.find(filtro)
            .select("-access_token -verify_token -phone_number_id -waba_id")
            .sort({ createdAt: -1 });

        return NextResponse.json({ ok: true, data: lineas });
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
        const { name, whatsapp_number, phone_number_id, waba_id, access_token, verify_token } = body;

        if (!name || !whatsapp_number || !phone_number_id || !waba_id || !access_token) {
            return NextResponse.json(
                { ok: false, error: "Faltan campos obligatorios: name, whatsapp_number, phone_number_id, waba_id, access_token" },
                { status: 400 }
            );
        }

        const linea = await LineasModel.create({
            name: name.trim(),
            whatsapp_number: whatsapp_number.trim(),
            phone_number_id: phone_number_id.trim(),
            waba_id: waba_id.trim(),
            access_token: access_token.trim(),
            verify_token: verify_token?.trim() || undefined,
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
