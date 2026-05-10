import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import dotenv from "dotenv";

const stringSession = new StringSession("");

(async () => {
    console.log("Iniciando autenticación interactiva de Telegram...");
    console.log("Si no tienes credenciales, obtenlas en https://my.telegram.org\n");

    const rawApiId = await input.text("Ingresa tu API_ID (número): ");
    const apiId = parseInt(rawApiId);
    if (isNaN(apiId)) {
        console.error("❌ ERROR: El API_ID debe ser un número válido.");
        process.exit(1);
    }

    const apiHash = await input.text("Ingresa tu API_HASH: ");
    if (!apiHash.trim()) {
        console.error("❌ ERROR: El API_HASH no puede estar vacío.");
        process.exit(1);
    }

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text("Número telefónico (ej. +584141234567): "),
        password: async () => await input.text("Contraseña de verificación en 2 pasos (deja en blanco si no aplica): "),
        phoneCode: async () => await input.text("Código recibido en la app de Telegram: "),
        onError: (err) => console.log(err),
    });

    console.log("\n✅ ¡Autenticación exitosa!");
    console.log("Copia esta cadena generada y guárdala en el campo `telegram_session` de la Línea en la base de datos:");
    console.log("─".repeat(80));
    console.log(client.session.save());
    console.log("─".repeat(80));
    console.log("Ya puedes cerrar este script (Ctrl+C).");
    process.exit(0);
})();
