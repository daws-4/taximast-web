import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi-token-secreto';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('BadRequest', { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Log the incoming webhook payload
        console.log("WhatsApp Webhook Event:", JSON.stringify(body, null, 2));

        // Handle messages (e.g., store location)
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            for (const msg of messages) {
                if (msg.type === 'location') {
                    console.log("Received Location:", msg.location);
                    // Here we would save to DB
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in WhatsApp webhook:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
