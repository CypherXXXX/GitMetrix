const HUGGINGFACE_API_URL =
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";

interface HuggingFaceErrorResponse {
    error: string;
    estimated_time?: number;
}

async function callHuggingFaceAPI(
    inputs: string | string[]
): Promise<number[] | number[][]> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
        throw new Error("HUGGINGFACE_API_KEY is not configured");
    }

    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetch(HUGGINGFACE_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs,
                options: { wait_for_model: true },
            }),
        });

        if (response.ok) {
            return response.json();
        }

        if (response.status === 503) {
            const errorBody =
                (await response.json()) as HuggingFaceErrorResponse;
            const waitTime = (errorBody.estimated_time || 20) * 1000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
        }

        if (response.status === 429) {
            const backoffMs = Math.pow(2, attempt + 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
        }

        if (response.status === 500 || response.status === 502 || response.status === 504) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
        }

        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(
            `HuggingFace API error: ${response.status} ${errorText}`
        );
    }

    throw new Error("HuggingFace API: max retries exceeded");
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const truncated = text.slice(0, 8000);
    const result = await callHuggingFaceAPI(truncated);
    return result as number[];
}

export async function generateEmbeddings(
    texts: string[]
): Promise<number[][]> {
    const truncated = texts.map((t) => t.slice(0, 8000));
    const batchSize = 8;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < truncated.length; i += batchSize) {
        const batch = truncated.slice(i, i + batchSize);
        const result = await callHuggingFaceAPI(batch);
        allEmbeddings.push(...(result as number[][]));
    }

    return allEmbeddings;
}
