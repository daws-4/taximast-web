"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Alert } from "@heroui/alert";
import { FormEvent } from "react";

// Paleta Taximast como constantes — garantiza que siempre se apliquen
const C = {
    onyx: "#0b0c0c",
    jetBlack: "#2a2e34",
    platinum: "#e9eaec",
    brightGold: "#fbe134",
    saffron: "#e4b61a",
} as const;

interface LoginCardProps {
    username: string;
    password: string;
    isLoading: boolean;
    error: string | null;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function LoginCard({
    username,
    password,
    isLoading,
    error,
    onUsernameChange,
    onPasswordChange,
    onSubmit,
}: LoginCardProps) {
    return (
        <Card
            className="w-full max-w-md shadow-2xl border border-white/10 backdrop-blur-md"
            radius="lg"
            style={{ backgroundColor: `${C.jetBlack}cc` }}
        >
            <CardHeader className="flex flex-col items-center gap-1 pt-9 pb-2 px-8">
                {/* Logo / Brand */}
                <span
                    className="text-5xl font-extrabold tracking-tight leading-none"
                    style={{ color: C.brightGold }}
                >
                    Taximast
                </span>
                <p className="text-sm mt-1" style={{ color: `${C.platinum}99` }}>
                    Plataforma de Operadores WhatsApp
                </p>
            </CardHeader>

            <CardBody className="px-8 pt-6 pb-9">
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                    {/* Mensaje de error */}
                    {error && (
                        <Alert
                            color="danger"
                            title={error}
                            role="alert"
                            variant="flat"
                            className="text-sm"
                        />
                    )}

                    {/* Campo usuario */}
                    <Input
                        id="username-input"
                        label="Usuario"
                        placeholder="Ingresa tu usuario"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onValueChange={onUsernameChange}
                        isRequired
                        isDisabled={isLoading}
                        radius="sm"
                        classNames={{
                            label: "font-medium",
                            inputWrapper: "transition-all",
                        }}
                        style={
                            {
                                "--input-label-color": C.platinum,
                                "--input-color": C.platinum,
                            } as React.CSSProperties
                        }
                        startContent={
                            <UserIcon
                                className="w-4 h-4 shrink-0"
                                style={{ color: `${C.platinum}66` }}
                            />
                        }
                    />

                    {/* Campo contraseña */}
                    <Input
                        id="password-input"
                        label="Contraseña"
                        placeholder="••••••••"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onValueChange={onPasswordChange}
                        isRequired
                        isDisabled={isLoading}
                        radius="sm"
                        classNames={{
                            label: "font-medium",
                            inputWrapper: "transition-all",
                        }}
                        startContent={
                            <LockIcon
                                className="w-4 h-4 shrink-0"
                                style={{ color: `${C.platinum}66` }}
                            />
                        }
                    />

                    {/* Botón de submit */}
                    <Button
                        id="login-button"
                        type="submit"
                        isLoading={isLoading}
                        isDisabled={isLoading}
                        radius="sm"
                        size="lg"
                        className="mt-1 font-bold text-base transition-all duration-300"
                        style={{
                            backgroundColor: C.brightGold,
                            color: C.onyx,
                            boxShadow: `0 0 20px ${C.brightGold}40`,
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                C.saffron;
                            (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                `0 0 30px ${C.saffron}60`;
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                C.brightGold;
                            (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                `0 0 20px ${C.brightGold}40`;
                        }}
                    >
                        {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                    </Button>
                </form>
            </CardBody>
        </Card>
    );
}

/* ─── Iconos SVG inline ─── */

function UserIcon({
    className,
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <svg
            className={className}
            style={style}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
    );
}

function LockIcon({
    className,
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <svg
            className={className}
            style={style}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}
