import { groqComplete, groqStream, isGroqAvailable } from "./groq";
import { openrouterComplete, openrouterStream, isOpenRouterAvailable, deepseekViaOpenrouterComplete, deepseekViaOpenrouterStream } from "./openrouter";
import { togetherComplete, togetherStream, isTogetherAvailable } from "./together";
import { cerebrasComplete, cerebrasStream, isCerebrasAvailable } from "./cerebras";
import { geminiComplete, geminiStream, isGeminiAvailable } from "./gemini";

type Messages = Array<{ role: "system" | "user" | "assistant"; content: string }>;
type LLMOptions = { temperature?: number; max_tokens?: number };
type StreamChunk = { content: string | null };

export type TaskType =
    | "chat_stream"
    | "query_expansion"
    | "large_context"
    | "deep_reasoning"
    | "consensus"
    | "general";

interface Provider {
    name: string;
    isAvailable: () => boolean;
    complete: (messages: Messages, options?: LLMOptions) => Promise<string>;
    stream: (messages: Messages, options?: LLMOptions) => Promise<AsyncIterable<StreamChunk>>;
}

const PROVIDER_REGISTRY: Record<string, Provider> = {
    cerebras: {
        name: "cerebras",
        isAvailable: isCerebrasAvailable,
        complete: cerebrasComplete,
        stream: cerebrasStream,
    },
    groq: {
        name: "groq",
        isAvailable: isGroqAvailable,
        complete: groqComplete,
        stream: groqStream,
    },
    gemini: {
        name: "gemini",
        isAvailable: isGeminiAvailable,
        complete: geminiComplete,
        stream: geminiStream,
    },
    deepseek_via_openrouter: {
        name: "deepseek_via_openrouter",
        isAvailable: isOpenRouterAvailable,
        complete: deepseekViaOpenrouterComplete,
        stream: deepseekViaOpenrouterStream,
    },
    openrouter: {
        name: "openrouter",
        isAvailable: isOpenRouterAvailable,
        complete: openrouterComplete,
        stream: openrouterStream,
    },
    together: {
        name: "together",
        isAvailable: isTogetherAvailable,
        complete: togetherComplete,
        stream: togetherStream,
    },
};

const TASK_ROUTING: Record<TaskType, string[]> = {
    chat_stream: ["cerebras", "groq", "openrouter", "together"],
    query_expansion: ["groq", "openrouter", "together"],
    large_context: ["gemini", "openrouter", "together"],
    deep_reasoning: ["deepseek_via_openrouter", "groq", "openrouter"],
    consensus: ["openrouter", "together", "groq"],
    general: ["groq", "cerebras", "openrouter", "together"],
};

function getProvidersForTask(taskType: TaskType): Provider[] {
    const preferredOrder = TASK_ROUTING[taskType] || TASK_ROUTING.general;
    const providers: Provider[] = [];

    for (const name of preferredOrder) {
        const provider = PROVIDER_REGISTRY[name];
        if (provider && provider.isAvailable()) {
            providers.push(provider);
        }
    }

    if (providers.length === 0) {
        for (const key of Object.keys(PROVIDER_REGISTRY)) {
            const provider = PROVIDER_REGISTRY[key];
            if (provider.isAvailable()) {
                providers.push(provider);
            }
        }
    }

    return providers;
}

function estimateTokenCount(messages: Messages): number {
    let chars = 0;
    for (const msg of messages) {
        chars += msg.content.length;
    }
    return Math.ceil(chars / 4);
}

function selectTaskType(taskType: TaskType, messages: Messages): TaskType {
    if (taskType !== "general") return taskType;

    const tokenCount = estimateTokenCount(messages);

    if (tokenCount > 30000) return "large_context";

    return taskType;
}

export async function routeComplete(
    taskType: TaskType,
    messages: Messages,
    options?: LLMOptions
): Promise<{ text: string; provider: string }> {
    const resolvedTask = selectTaskType(taskType, messages);
    const providers = getProvidersForTask(resolvedTask);

    if (providers.length === 0) {
        throw new Error("No LLM providers configured");
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            const text = await provider.complete(messages, options);
            return { text, provider: provider.name };
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    throw lastError || new Error("All LLM providers failed");
}

export async function routeStream(
    taskType: TaskType,
    messages: Messages,
    options?: LLMOptions
): Promise<{ stream: AsyncIterable<StreamChunk>; provider: string }> {
    const resolvedTask = selectTaskType(taskType, messages);
    const providers = getProvidersForTask(resolvedTask);

    if (providers.length === 0) {
        throw new Error("No LLM providers configured");
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            const stream = await provider.stream(messages, options);
            return { stream, provider: provider.name };
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
    }

    throw lastError || new Error("All LLM providers failed");
}

export async function llmComplete(
    messages: Messages,
    options?: LLMOptions
): Promise<{ text: string; provider: string }> {
    return routeComplete("general", messages, options);
}

export async function llmStream(
    messages: Messages,
    options?: LLMOptions
): Promise<{ stream: AsyncIterable<StreamChunk>; provider: string }> {
    return routeStream("general", messages, options);
}
