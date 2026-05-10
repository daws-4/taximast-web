import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { platform, ...rest } = body;
        
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const target = platform === 'telegram' 
            ? `${baseUrl}/api/telegram/send` 
            : `${baseUrl}/api/whatsapp/send`;

        const res = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rest)
        });
        
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('[api-send] Error:', error);
        return NextResponse.json({ success: false, error: "Error enrutando el mensaje" }, { status: 500 });
    }
}
