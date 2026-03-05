import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
    throw new Error("Por favor define la variable de entorno JWT_SECRET en .env");
}

export interface JWTPayload {
    id: string;
    username: string;
    nombre: string;
    rol: "admin" | "operador" | "admin_linea";
    linea: string;
}

/**
 * Genera un JWT firmado con los datos del operador.
 * Expira en 24 horas.
 */
export function signToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

/**
 * Verifica y decodifica un JWT.
 * Retorna el payload si es válido, null si está expirado o es inválido.
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Extrae el token JWT de la cookie HttpOnly o del header Authorization.
 */
export function getTokenFromRequest(req: NextRequest): string | null {
    // Prioridad 1: Cookie HttpOnly (flujo web normal)
    const cookie = req.cookies.get("taximast_token")?.value;
    if (cookie) return cookie;

    // Prioridad 2: Header Authorization: Bearer <token> (para clientes API externos)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.replace("Bearer ", "");
    }

    return null;
}

type HandlerHelper = (req: NextRequest, params?: any) => Promise<NextResponse> | NextResponse;

/**
 * HOF que protege un API route verificando el JWT.
 * Inyecta el payload del token como `req.user` (via header interno).
 */
export function withAuth(handler: HandlerHelper): HandlerHelper {
    return async (req: NextRequest, params?: any) => {
        const token = getTokenFromRequest(req);

        if (!token) {
            return NextResponse.json(
                { success: false, error: "No autenticado" },
                { status: 401 }
            );
        }

        const payload = verifyToken(token);

        if (!payload) {
            return NextResponse.json(
                { success: false, error: "Token inválido o expirado" },
                { status: 401 }
            );
        }

        // Añadir el payload directamente al request para no clonar la petición
        // (clonar NextRequest en producción puede causar pérdida de nextUrl o body)
        (req as any).user = payload;

        return handler(req, params);
    };
}

/**
 * Helper para leer el usuario inyectado por withAuth dentro de un handler.
 */
export function getUserFromRequest(req: NextRequest): JWTPayload | null {
    try {
        // Obtenemos el usuario inyectado directamente
        if ((req as any).user) {
            return (req as any).user as JWTPayload;
        }

        // Fallback por si acaso usamos header en un futuro
        const raw = req.headers.get("x-user-payload");
        return raw ? (JSON.parse(raw) as JWTPayload) : null;
    } catch {
        return null;
    }
}
