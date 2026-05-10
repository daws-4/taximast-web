import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChatWhatsAppClient from "@/components/dashboard/ChatWhatsAppClient";

export default async function ChatWhatsAppPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) redirect("/login");

    return <ChatWhatsAppClient user={user} />;
}
