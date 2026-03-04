"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginCard } from "@/components/login/LoginCard";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                setError(data.error ?? "Error al iniciar sesión");
                return;
            }

            const redirect = searchParams.get("redirect") ?? "/dashboard";
            router.push(redirect);
            router.refresh();
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <LoginCard
            username={username}
            password={password}
            isLoading={isLoading}
            error={error}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
        />
    );
}

export default function LoginPage() {
    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <Suspense fallback={<div className="text-white opacity-50 text-sm">Cargando panel de inicio...</div>}>
                <LoginForm />
            </Suspense>
        </main>
    );
}
