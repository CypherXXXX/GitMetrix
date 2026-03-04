import Groq from "groq-sdk";

const MODEL = "llama-3.3-70b-versatile";

let instance: Groq | null = null;

function getClient(): Groq {
    if (!instance) {
        instance = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return instance;
}

export async function groqComplete(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
    const client = getClient();
    const response = await client.chat.completions.create({
        model: MODEL,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.max_tokens ?? 4096,
    });
    return response.choices[0]?.message?.content || "";
}

export async function groqStream(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: { temperature?: number; max_tokens?: number }
): Promise<AsyncIterable<{ content: string | null }>> {
    const client = getClient();
    const stream = await client.chat.completions.create({
        model: MODEL,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.max_tokens ?? 4096,
        stream: true,
    });

    return {
        async *[Symbol.asyncIterator]() {
            for await (const chunk of stream) {
                yield { content: chunk.choices[0]?.delta?.content || null };
            }
        },
    };
}

export function isGroqAvailable(): boolean {
    return !!process.env.GROQ_API_KEY;
}
