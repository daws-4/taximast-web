import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import LineasClient from "@/components/admin/LineasClient";

export default async function AdminLineasPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) redirect("/login");
    // Solo administrador global puede ver y editar la lista de líneas comerciales
    if (user.rol !== "admin") redirect("/dashboard");

    return <LineasClient user={user} />;
}
