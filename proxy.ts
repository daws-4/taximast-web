import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = [
    "/login",
    "/api/auth/login",
    "/api/whatsapp/webhook",
    "/api/telegram/ai-reply", // Excepción para la IA interna
    "/api/aireply",           // Nueva ruta simplificada
    "/api/contact"
];

// Rutas de API que requieren API Key (no JWT) - FoxPro / Integraciones
const API_KEY_ROUTES = [
    "/api/dispatch",
    "/api/status",
    "/api/whatsapp",
    "/api/telegram"           // Permitir acceso a Telegram via API Key
];

// Rutas exclusivas del admin global (gestión de todas las líneas)
const ADMIN_GLOBAL_ROUTES = [
    "/admin/lineas",
    "/admin/estadisticas",
];

// Rutas accesibles por admin global Y admin de línea
const ADMIN_SHARED_ROUTES = [
    "/admin/operadores",
    "/admin",
];

export function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get("taximast_token")?.value;

    // 1. Permitir rutas públicas y assets INMEDIATAMENTE
    const isPublic =
        pathname === "/" ||
        PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon");

    if (isPublic) {
        // console.log(`[Proxy] Ruta pública permitida: ${pathname}`);
        return NextResponse.next();
    }

    // 2. Si hay token válido y el usuario intenta acceder a /login → redirigir al dashboard
    if (token && pathname.startsWith("/login")) {
        const payload = verifyToken(token);
        if (payload) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }
    }

    // 3. Rutas de API externas (API Key o JWT)
    const isApiKeyRoute = API_KEY_ROUTES.some(route => pathname.startsWith(route));
    if (isApiKeyRoute && !pathname.startsWith("/api/whatsapp/webhook")) {
        const authHeader = req.headers.get("authorization");
        const xApiKey = req.headers.get("x-api-key");
        const waApiKey = process.env.WA_API_KEY;
        const hasValidToken = token && verifyToken(token);

        let passesApiKey = false;
        let providedKey = xApiKey;
        if (!providedKey && authHeader && authHeader.startsWith('Bearer ')) {
            providedKey = authHeader.substring(7);
        }

        if (!waApiKey || providedKey === waApiKey) {
            passesApiKey = true;
        }

        if (!passesApiKey && !hasValidToken) {
            console.warn(`[Proxy] 401 - Acceso denegado a ruta de API: ${pathname}`);
            return NextResponse.json(
                { error: "API key inválida o faltante", connected: false },
                { status: 401 }
            );
        }

        return NextResponse.next();
    }

    // 4. Verificación de sesión para el resto de rutas
    if (!token) {
        console.warn(`[Proxy] 302 - Sin token en ruta protegida: ${pathname}`);
        return NextResponse.redirect(new URL("/", req.url));
    }

    const payload = verifyToken(token);
    if (!payload) {
        const response = NextResponse.redirect(new URL("/", req.url));
        response.cookies.set("taximast_token", "", { maxAge: 0, path: "/" });
        return response;
    }

    // ── Control de acceso por rol ──────────────────────────────────────────────

    // Rutas exclusivas del admin global (todas las líneas)
    const isAdminGlobalRoute = ADMIN_GLOBAL_ROUTES.some((route) =>
        pathname.startsWith(route)
    );

    if (isAdminGlobalRoute && payload.rol !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Rutas compartidas entre admin global y admin de línea
    const isAdminSharedRoute = ADMIN_SHARED_ROUTES.some((route) =>
        pathname.startsWith(route)
    );

    if (
        isAdminSharedRoute &&
        payload.rol !== "admin" &&
        payload.rol !== "admin_linea"
    ) {
        // Operador normal no puede acceder → redirigir al dashboard
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|api/auth/login|api/auth/logout).*)",
    ],
};
