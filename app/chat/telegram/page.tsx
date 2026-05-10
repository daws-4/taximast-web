import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChatTelegramClient from "@/components/dashboard/ChatTelegramClient";

export default async function ChatTelegramPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) redirect("/login");

    return <ChatTelegramClient user={user} />;
}
