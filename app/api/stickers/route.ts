import { NextResponse } from "next/server";
import { getStickers } from "@/lib/pocketbase";

export async function GET() {
    try {
        const stickers = await getStickers();
        return NextResponse.json({ success: true, data: stickers });
    } catch (error) {
        console.error("[api/stickers] Error fetching stickers:", error);
        return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
    }
}
