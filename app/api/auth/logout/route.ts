import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ ok: true, message: "Sesión cerrada" });

    // Borrar la cookie sobreescribiéndola con maxAge 0
    response.cookies.set("taximast_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });

    return response;
}
