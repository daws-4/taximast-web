import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Iniciar sesión — Taximast",
    description: "Accede a la plataforma de operadores de Taximast",
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="min-h-screen antialiased font-sans"
            style={{
                background: "linear-gradient(135deg, #0b0c0c 0%, #2a2e34 100%)",
            }}
        >
            {children}
        </div>
    );
}
