import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        connected: true,
        service: "whatsapp-business-api",
        timestamp: new Date().toISOString()
    });
}
