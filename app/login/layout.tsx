import "@/styles/globals.css";
import { Providers } from "@/app/providers";

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <title>Iniciar sesión — Taximast</title>
                <meta name="description" content="Accede a la plataforma de operadores de Taximast" />
            </head>
            <body
                className="min-h-screen antialiased font-sans"
                style={{
                    background: "linear-gradient(135deg, #0b0c0c 0%, #2a2e34 100%)",
                }}
            >
                <Providers themeProps={{ attribute: "class", defaultTheme: "light", forcedTheme: "light" }}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}

