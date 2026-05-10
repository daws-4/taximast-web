import { Server } from "socket.io";
import { TelegramClient } from "telegram";

declare global {
    // eslint-disable-next-line no-var
    var io: Server | undefined;
    // eslint-disable-next-line no-var
    var telegramClients: Map<string, TelegramClient> | undefined;
}
