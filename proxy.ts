import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = ["/login", "/api/auth/login"];

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

    // Permitir rutas públicas y assets de Next.js
    const isPublic =
        pathname === "/" ||
        PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon");

    if (isPublic) return NextResponse.next();

    // Verificar token JWT desde la cookie
    const token = req.cookies.get("taximast_token")?.value;

    if (!token) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    const payload = verifyToken(token);

    if (!payload) {
        // Token inválido o expirado → limpiar cookie y redirigir
        const loginUrl = new URL("/login", req.url);
        const response = NextResponse.redirect(loginUrl);
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
