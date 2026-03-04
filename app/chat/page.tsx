import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChatPageClient from "@/components/dashboard/ChatPageClient";

export default async function ChatPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) redirect("/login");

    return <ChatPageClient user={user} />;
}
