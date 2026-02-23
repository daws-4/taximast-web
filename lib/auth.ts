import { NextRequest, NextResponse } from 'next/server';

type HandlerHelper = (req: NextRequest, params?: any) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: HandlerHelper): HandlerHelper {
    return async (req: NextRequest, params?: any) => {
        // Basic API Key Authentication
        const authHeader = req.headers.get('authorization');
        const apiKey = process.env.VFP_API_KEY || 'taximast-secret-key';

        // Allow Bearer token or just the key
        const token = authHeader?.replace('Bearer ', '');

        if (!token || token !== apiKey) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        return handler(req, params);
    };
}
