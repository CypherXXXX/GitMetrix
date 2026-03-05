const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const MODEL = "llama-3.3-70b";

async function callCerebras(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number; stream?: boolean }
): Promise<Response> {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) throw new Error("CEREBRAS_API_KEY not configured");

    const response = await fetch(CEREBRAS_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.max_tokens ?? 4096,
            stream: options?.stream ?? false,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Cerebras error: ${response.status} ${errorText}`);
    }

    return response;
}

export async function cerebrasComplete(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
    const response = await callCerebras(messages, { ...options, stream: false });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

export async function cerebrasStream(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
): Promise<AsyncIterable<{ content: string | null }>> {
    const response = await callCerebras(messages, { ...options, stream: true });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Cerebras: no response body");

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
                        const content = parsed.choices?.[0]?.delta?.content || null;
                        if (content) yield { content };
                    } catch (_) { }
                }
            }
        },
    };
}

export function isCerebrasAvailable(): boolean {
    return !!process.env.CEREBRAS_API_KEY;
}
