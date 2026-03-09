import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import StatsClient from "@/components/admin/StatsClient";

export default async function AdminEstadisticasPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) redirect("/login");
    
    // Solo admisiones para admins o admin de línea
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        redirect("/dashboard");
    }

    return <StatsClient user={user} />;
}
