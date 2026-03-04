// server.mjs — Custom HTTP server para Next.js + Socket.io
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => handle(req, res));

    const io = new Server(httpServer, {
        path: "/api/socketio",
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // Exponer io globalmente para que las API routes puedan emitir eventos
    global.io = io;

    io.on("connection", (socket) => {
        // Cliente se une a la sala de su línea (recibe todos los eventos de esa línea)
        socket.on("join:linea", (lineaId) => {
            if (lineaId) socket.join(`linea:${lineaId}`);
        });

        // Cliente se une a la sala de un chat específico (para mensajes en tiempo real)
        socket.on("join:chat", (chatId) => {
            if (chatId) socket.join(`chat:${chatId}`);
        });

        // Cliente abandona la sala de un chat (cuando cierra el panel)
        socket.on("leave:chat", (chatId) => {
            if (chatId) socket.leave(`chat:${chatId}`);
        });

        socket.on("disconnect", () => {
            // Socket.io limpia las salas automáticamente al desconectar
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`);
    });
});
