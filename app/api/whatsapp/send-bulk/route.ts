import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, type } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { success: false, error: "Missing or empty 'messages' array" },
                { status: 400 }
            );
        }

        console.log(`Mock WhatsApp Bulk Send (Type: ${type}):`, messages.length, "messages");

        // Mock successful bulk send
        // In a real scenario, we would iterate and send individual requests
        return NextResponse.json({
            success: true,
            sent: messages.length,
            failed: 0
        });
    } catch (error) {
        console.error("Error in WhatsApp bulk send:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
