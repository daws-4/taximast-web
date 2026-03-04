import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import OperadoresClient from "@/components/admin/OperadoresClient";

export default async function OperadoresPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("taximast_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) {
        redirect("/login");
    }

    // Only admit admins or admin_linea
    if (user.rol !== "admin" && user.rol !== "admin_linea") {
        redirect("/dashboard");
    }

    return <OperadoresClient user={user} />;
}
