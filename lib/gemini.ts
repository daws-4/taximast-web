import { GoogleGenerativeAI } from "@google/generative-ai";
import { IMessage } from "@/models/Chats";

interface GeminiServiceProps {
    apiKey: string;
    lineaName: string;
    chatHistoria: IMessage[];
    clienteName?: string;
    customPrompt?: string;
}

interface GeminiResult {
    text: string;       // Respuesta limpia para enviar al cliente por WhatsApp
    thinking: string;   // Razonamiento interno de la IA (solo visible para operadores)
    handoff: boolean;   // true si la IA determinó que ya recopiló los datos
    noResponse: boolean; // true si la IA determinó que no necesita responder al cliente
}

export async function getGeminiReply({ apiKey, lineaName, chatHistoria, clienteName, customPrompt }: GeminiServiceProps): Promise<GeminiResult | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // [OFICIAL] Usando gemini-2.5-flash confirmado por el script de diagnóstico
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Build the system prompt contextualizing the AI behavior
        const handoffInstruction = `

INSTRUCCIÓN TÉCNICA MUY IMPORTANTE (NUNCA la menciones al cliente):
- Cuando hayas recopilado exitosamente los 4 datos del traslado: NOMBRE del pasajero, NÚMERO DE TELÉFONO del pasajero, ORIGEN y DESTINO, debes incluir la etiqueta [LISTO] al FINAL de tu mensaje de confirmación.
- SOLO incluye [LISTO] cuando ya tengas los 4 datos claros.
- NO menciones la palabra "[LISTO]" al cliente, es una señal interna del sistema.
- Si falta algún dato, sigue preguntando hasta obtenerlo.`;

        const genericPrompt = `Eres el asistente virtual amable, profesional y conciso de la línea de taxis "${lineaName}". 
Tu objetivo es resolver rápidamente dudas de los clientes, ayudarles a solicitar un taxi o darles tarifas referenciales. 
Sé muy breve en tus respuestas (1 o 2 párrafos cortos como máximo). Usa emojis esporádicamente para empatizar. 
Para procesar un traslado necesitas 4 datos: nombre del pasajero, número de teléfono del pasajero, ubicación de recogida y destino. Pídelos todos en un solo mensaje. Ten en cuenta que quien escribe puede estar solicitando el taxi para otra persona.
El cliente con el que hablas se llama ${clienteName || "Cliente"}.${handoffInstruction}`;

        const systemPrompt = customPrompt 
            ? `${customPrompt.trim()}\n\n[Contexto Automático de TAXIMAST: El cliente habla con la empresa ${lineaName} y su nombre es ${clienteName || "Cliente"}.]\n${handoffInstruction}` 
            : genericPrompt;

        // Format conversational history for Gemini
        type ContentRole = "user" | "model";
        const history: { role: ContentRole, parts: { text: string }[] }[] = [];
        
        let lastRole: ContentRole | null = null;
        
        for (const msg of chatHistoria) {
            const role: ContentRole = msg.origen === "cliente" ? "user" : "model";
            let text = msg.texto;
            
            // Ignorar mensajes iniciales que no sean del usuario (Gemini requiere empezar por 'user')
            if (history.length === 0 && role !== "user") continue;

            // Add metadata for multimedia messages to help the AI understand them
            if (msg.tipo && msg.tipo !== "text") {
                text = `[El usuario envió un ${msg.tipo}. Contenido/Descripción: ${msg.texto || "N/A"}]`;
            }

            if (role === lastRole && history.length > 0) {
                // Merge texts from the same consecutive role
                history[history.length - 1].parts[0].text += `\n${text}`;
            } else {
                history.push({
                    role,
                    parts: [{ text }],
                });
                lastRole = role;
            }
        }

        // Initialize Chat session
        const chat = model.startChat({
            history: history,
            systemInstruction: {
                role: "system",
                parts: [{ text: systemPrompt }]
            }
        });

        let messageToSend = "";
        
        if (history.length > 0 && history[history.length - 1].role === "user") {
             messageToSend = history.pop()!.parts[0].text;
        } else {
            messageToSend = "Hola, necesito un taxi.";
        }
        // Enviar mensaje con retry automático para manejar 429 (Rate Limit)
        const MAX_RETRIES = 3;
        let result;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                result = await chat.sendMessage(messageToSend);
                break; // Éxito → salir del loop
            } catch (err: any) {
                const status = err?.status ?? err?.httpStatusCode ?? err?.errorDetails?.[0]?.reason;
                if ((status === 429 || String(err).includes('429')) && attempt < MAX_RETRIES - 1) {
                    const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
                    console.warn(`[gemini] Rate limit (429). Reintentando en ${waitMs / 1000}s... (intento ${attempt + 1}/${MAX_RETRIES})`);
                    await new Promise(r => setTimeout(r, waitMs));
                } else {
                    throw err; // Error no recuperable o último intento
                }
            }
        }

        if (!result) {
            console.error("[gemini] No se obtuvo resultado tras reintentos.");
            return null;
        }
        
        // ─── Separar pensamiento de respuesta ──────────────────────────────────
        // Gemini 2.5 Flash devuelve partes con un flag `thought: true` para el
        // razonamiento interno (chain-of-thought). Debemos extraerlo aparte
        // para que NUNCA se envíe al cliente por WhatsApp.
        const candidate = result.response.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];
        
        let thinking = "";
        let responseText = "";
        
        for (const part of parts) {
            const p = part as { text?: string; thought?: boolean };
            if (p.text) {
                if (p.thought) {
                    // Parte de pensamiento interno → solo para operadores
                    thinking += (thinking ? "\n" : "") + p.text;
                } else {
                    // Parte de respuesta real → se envía al cliente
                    responseText += (responseText ? "\n" : "") + p.text;
                }
            }
        }

        // Si por alguna razón no se separaron las partes, usar el método text() como fallback
        if (!responseText) {
            responseText = result.response.text();
        }

        // Detect the [LISTO] handoff tag
        const handoff = responseText.includes("[LISTO]");
        // Strip the tag from the visible message
        let cleanText = responseText.replace(/\[LISTO\]/gi, "").trim();

        // Detectar si la IA decidió que no necesita responder al cliente.
        // Patrones: texto entre corchetes como [No se requiere respuesta...],
        // o texto que empiece con "[No " o "[Sin respuesta" etc.
        const isInternalOnly = /^\[.*\]$/.test(cleanText.trim());
        let noResponse = false;

        if (isInternalOnly) {
            // Mover el texto a thinking y marcar como sin respuesta
            thinking = (thinking ? thinking + "\n" : "") + cleanText;
            cleanText = "";
            noResponse = true;
        }

        return { text: cleanText, thinking: thinking.trim(), handoff, noResponse };

    } catch (error) {
        console.error("[Gemini API Error]", error);
        return null;
    }
}
