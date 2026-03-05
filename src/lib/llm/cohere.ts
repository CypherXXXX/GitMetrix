const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank";
const RERANK_MODEL = "rerank-v3.5";

export interface RerankResult {
    index: number;
    relevanceScore: number;
}

export async function cohereRerank(
    query: string,
    documents: string[],
    topN: number = 12
): Promise<RerankResult[]> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) throw new Error("COHERE_API_KEY not configured");

    if (documents.length === 0) return [];

    const truncatedDocs = documents.map((d) => d.slice(0, 4096));

    const response = await fetch(COHERE_RERANK_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: RERANK_MODEL,
            query,
            documents: truncatedDocs,
            top_n: Math.min(topN, documents.length),
            return_documents: false,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Cohere rerank error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return (data.results || []).map(
        (r: { index: number; relevance_score: number }) => ({
            index: r.index,
            relevanceScore: r.relevance_score,
        })
    );
}

export function isCohereAvailable(): boolean {
    return !!process.env.COHERE_API_KEY;
}
