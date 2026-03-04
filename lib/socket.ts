// lib/socket.ts — Singleton del cliente Socket.io para usar en Client Components
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket || !socket.connected) {
        socket = io({
            path: "/api/socketio",
            transports: ["websocket"],
            autoConnect: true,
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// Eventos emitidos desde el servidor
export const SOCKET_EVENTS = {
    NUEVO_MENSAJE: "chat:nuevo_mensaje",
    NUEVO_CHAT: "chat:nuevo_chat",
    ESTADO_CAMBIADO: "chat:estado_cambiado",
} as const;

// Eventos emitidos desde el cliente
export const CLIENT_EVENTS = {
    JOIN_LINEA: "join:linea",
    JOIN_CHAT: "join:chat",
    LEAVE_CHAT: "leave:chat",
} as const;
