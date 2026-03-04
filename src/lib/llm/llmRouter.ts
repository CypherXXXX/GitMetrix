import { groqComplete, groqStream, isGroqAvailable } from "./groq";
import { openrouterComplete, openrouterStream, isOpenRouterAvailable } from "./openrouter";
import { togetherComplete, togetherStream, isTogetherAvailable } from "./together";

type Messages = Array<{ role: "system" | "user" | "assistant"; content: string }>;
type LLMOptions = { temperature?: number; max_tokens?: number };
type StreamChunk = { content: string | null };

interface Provider {
    name: string;
    isAvailable: () => boolean;
    complete: (messages: Messages, options?: LLMOptions) => Promise<string>;
    stream: (messages: Messages, options?: LLMOptions) => Promise<AsyncIterable<StreamChunk>>;
}

const PROVIDERS: Provider[] = [
    {
        name: "groq",
        isAvailable: isGroqAvailable,
        complete: groqComplete,
        stream: groqStream,
    },
    {
        name: "openrouter",
        isAvailable: isOpenRouterAvailable,
        complete: openrouterComplete,
        stream: openrouterStream,
    },
    {
        name: "together",
        isAvailable: isTogetherAvailable,
        complete: togetherComplete,
        stream: togetherStream,
    },
];

function getAvailableProviders(): Provider[] {
    return PROVIDERS.filter((p) => p.isAvailable());
}

export async function llmComplete(
    messages: Messages,
    options?: LLMOptions
): Promise<{ text: string; provider: string }> {
    const available = getAvailableProviders();
    if (available.length === 0) {
        throw new Error("No LLM providers configured");
    }

    let lastError: Error | null = null;

    for (const provider of available) {
        try {
            const text = await provider.complete(messages, options);
            return { text, provider: provider.name };
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    throw lastError || new Error("All LLM providers failed");
}

export async function llmStream(
    messages: Messages,
    options?: LLMOptions
): Promise<{ stream: AsyncIterable<StreamChunk>; provider: string }> {
    const available = getAvailableProviders();
    if (available.length === 0) {
        throw new Error("No LLM providers configured");
    }

    let lastError: Error | null = null;

    for (const provider of available) {
        try {
            const stream = await provider.stream(messages, options);
            return { stream, provider: provider.name };
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    throw lastError || new Error("All LLM providers failed");
}
