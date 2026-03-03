const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

const FUNCTION_BOUNDARY_PATTERNS = [
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
    /^(?:export\s+)?class\s+\w+/,
    /^(?:export\s+)?interface\s+\w+/,
    /^(?:export\s+)?type\s+\w+/,
    /^(?:export\s+)?enum\s+\w+/,
    /^(?:public|private|protected|static|async)\s+\w+\s*\(/,
    /^def\s+\w+/,
    /^class\s+\w+/,
];

function isBoundaryLine(line: string): boolean {
    const trimmed = line.trim();
    return FUNCTION_BOUNDARY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function createChunkWithContext(
    content: string,
    filePath: string,
    chunkIndex: number
): string {
    return `File: ${filePath}\nChunk: ${chunkIndex}\n---\n${content}`;
}

function splitByBoundaries(content: string): string[] {
    const lines = content.split("\n");
    const sections: string[] = [];
    let currentSection: string[] = [];

    for (const line of lines) {
        if (isBoundaryLine(line) && currentSection.length > 3) {
            sections.push(currentSection.join("\n"));
            currentSection = [line];
        } else {
            currentSection.push(line);
        }
    }

    if (currentSection.length > 0) {
        sections.push(currentSection.join("\n"));
    }

    return sections;
}

function slidingWindowChunk(text: string): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
        let chunk = text.slice(startIndex, endIndex);

        if (endIndex < text.length) {
            const lastNewline = chunk.lastIndexOf("\n");
            if (lastNewline > CHUNK_SIZE * 0.3) {
                chunk = chunk.slice(0, lastNewline);
            }
        }

        if (chunk.trim().length > 0) {
            chunks.push(chunk.trim());
        }

        const advance = chunk.length - CHUNK_OVERLAP;
        if (advance <= 0) {
            startIndex += Math.max(chunk.length, 1);
        } else {
            startIndex += advance;
        }
    }

    return chunks;
}

export function chunkFileContent(
    content: string,
    filePath: string
): string[] {
    if (content.length <= CHUNK_SIZE) {
        return [createChunkWithContext(content, filePath, 0)];
    }

    const sections = splitByBoundaries(content);
    const rawChunks: string[] = [];

    for (const section of sections) {
        if (section.length <= CHUNK_SIZE) {
            rawChunks.push(section);
        } else {
            rawChunks.push(...slidingWindowChunk(section));
        }
    }

    const mergedChunks: string[] = [];
    let buffer = "";

    for (const chunk of rawChunks) {
        if (buffer.length + chunk.length + 1 <= CHUNK_SIZE) {
            buffer = buffer ? `${buffer}\n${chunk}` : chunk;
        } else {
            if (buffer) mergedChunks.push(buffer);
            buffer = chunk;
        }
    }

    if (buffer) mergedChunks.push(buffer);

    return mergedChunks.map((chunk, index) =>
        createChunkWithContext(chunk, filePath, index)
    );
}
