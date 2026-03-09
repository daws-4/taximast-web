import { NextRequest, NextResponse } from "next/server";
import { withAuth, getUserFromRequest } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "conductores");

// POST /api/admin/conductores/upload — subir foto de identificación
async function postHandler(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        return NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("foto") as File | null;

        if (!file) {
            return NextResponse.json({ ok: false, error: "No se envió ningún archivo" }, { status: 400 });
        }

        // Validar tipo de archivo
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ ok: false, error: "Solo se permiten imágenes JPG, PNG o WebP" }, { status: 400 });
        }

        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ ok: false, error: "El archivo no puede superar 5MB" }, { status: 400 });
        }

        // Crear directorio si no existe
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Generar nombre único
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `conductor_${Date.now()}.${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Escribir archivo
        const bytes = await file.arrayBuffer();
        await writeFile(filepath, new Uint8Array(bytes));

        const url = `/uploads/conductores/${filename}`;

        return NextResponse.json({ ok: true, data: { url } }, { status: 201 });
    } catch (error) {
        console.error("[ADMIN/CONDUCTORES UPLOAD] Error:", error);
        return NextResponse.json({ ok: false, error: "Error al subir el archivo" }, { status: 500 });
    }
}

export const POST = withAuth(postHandler);
