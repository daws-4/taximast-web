import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone, message, type, image } = body;

        if (!phone || !message || !type) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: phone, message, type" },
                { status: 400 }
            );
        }

        console.log("Mock WhatsApp Send:", { phone, message, type, image });

        // Mock successful response
        return NextResponse.json({
            success: true,
            messageId: `wamid.mock.${Date.now()}.${Math.random().toString(36).substring(7)}`
        });
    } catch (error) {
        console.error("Error in WhatsApp send:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
