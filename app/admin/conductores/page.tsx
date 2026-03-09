import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import ConductoresClient from "@/components/admin/ConductoresClient";

export default async function ConductoresPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) {
        redirect("/login");
    }

    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        redirect("/dashboard");
    }

    return <ConductoresClient user={user} />;
}
