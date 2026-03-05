const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.0-flash";

interface GeminiContent {
    role: "user" | "model";
    parts: Array<{ text: string }>;
}

function convertMessages(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): { systemInstruction: string | null; contents: GeminiContent[] } {
    let systemInstruction: string | null = null;
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${msg.content}`
                : msg.content;
        } else {
            contents.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            });
        }
    }

    if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "" }] });
    }

    return { systemInstruction, contents };
}

export async function geminiComplete(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const { systemInstruction, contents } = convertMessages(messages);

    const body: Record<string, unknown> = {
        contents,
        generationConfig: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.max_tokens ?? 4096,
        },
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(
        `${GEMINI_API_URL}/${MODEL}:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Gemini error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function geminiStream(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
): Promise<AsyncIterable<{ content: string | null }>> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const { systemInstruction, contents } = convertMessages(messages);

    const body: Record<string, unknown> = {
        contents,
        generationConfig: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.max_tokens ?? 4096,
        },
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(
        `${GEMINI_API_URL}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Gemini stream error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Gemini: no response body");

    const decoder = new TextDecoder();

    return {
        async *[Symbol.asyncIterator]() {
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data: ")) continue;
                    const payload = trimmed.slice(6);
                    if (payload === "[DONE]") return;
                    try {
                        const parsed = JSON.parse(payload);
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || null;
                        if (text) yield { content: text };
                    } catch (_) { }
                }
            }
        },
    };
}

export function isGeminiAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
}
