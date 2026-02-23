import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
        return NextResponse.json(
            { error: "Phone number required" },
            { status: 400 }
        );
    }

    // Mock location data
    // In a real scenario, query the database for the last location from this phone
    const mockLocation = {
        found: true,
        latitude: 10.4806,
        longitude: -66.9036,
        maps_url: "https://maps.google.com/?q=10.4806,-66.9036",
        timestamp: new Date().toISOString()
    };

    // Simulate "not found" for a specific number if needed for testing, e.g., ending in 000
    if (phone.endsWith("000")) {
        return NextResponse.json({ found: false });
    }

    return NextResponse.json(mockLocation);
}
