import type { ParsedFile, CodeChunk, CodeSymbol, SymbolType } from "./types";

const TARGET_MIN_TOKENS = 300;
const TARGET_MAX_TOKENS = 800;
const APPROX_CHARS_PER_TOKEN = 4;
const MIN_CHARS = TARGET_MIN_TOKENS * APPROX_CHARS_PER_TOKEN;
const MAX_CHARS = TARGET_MAX_TOKENS * APPROX_CHARS_PER_TOKEN;

export function chunkFile(parsedFile: ParsedFile): CodeChunk[] {
    const { content, filePath, language, symbols } = parsedFile;

    if (content.length <= MAX_CHARS && symbols.length === 0) {
        return [createChunk(content, filePath, null, null, 0, language, 1, parsedFile.lineCount, null)];
    }

    if (symbols.length === 0) {
        return chunkPlainText(content, filePath, language);
    }

    return chunkWithSymbols(parsedFile);
}

function chunkWithSymbols(parsedFile: ParsedFile): CodeChunk[] {
    const { content, filePath, language, symbols } = parsedFile;
    const lines = content.split("\n");
    const chunks: CodeChunk[] = [];
    let chunkIndex = 0;

    const sortedSymbols = [...symbols].sort((a, b) => a.startLine - b.startLine);

    const coveredLines = new Set<number>();
    for (const sym of sortedSymbols) {
        for (let l = sym.startLine; l <= sym.endLine; l++) {
            coveredLines.add(l);
        }
    }

    let headerLines: string[] = [];
    let headerStart = 1;
    for (let i = 1; i <= lines.length; i++) {
        if (coveredLines.has(i)) break;
        headerLines.push(lines[i - 1]);
    }

    if (headerLines.length > 0) {
        const headerContent = headerLines.join("\n").trim();
        if (headerContent.length > 0) {
            chunks.push(createChunk(
                headerContent,
                filePath,
                "module-header",
                "module",
                chunkIndex++,
                language,
                headerStart,
                headerLines.length,
                null
            ));
        }
    }

    for (const symbol of sortedSymbols) {
        if (symbol.parentSymbol && sortedSymbols.some(
            (s) => s.name === symbol.parentSymbol && s.startLine <= symbol.startLine && s.endLine >= symbol.endLine
        )) {
            continue;
        }

        const symbolContent = symbol.content;

        if (symbolContent.length <= MAX_CHARS) {
            chunks.push(createChunk(
                symbolContent,
                filePath,
                symbol.name,
                symbol.type,
                chunkIndex++,
                language,
                symbol.startLine,
                symbol.endLine,
                symbol.parentSymbol
            ));
        } else {
            const subChunks = splitLargeSymbol(symbol, filePath, language, chunkIndex);
            chunks.push(...subChunks);
            chunkIndex += subChunks.length;
        }
    }

    let gapBuffer: string[] = [];
    let gapStart = 0;
    for (let i = 1; i <= lines.length; i++) {
        if (!coveredLines.has(i) && i > headerLines.length) {
            if (gapBuffer.length === 0) gapStart = i;
            gapBuffer.push(lines[i - 1]);
        } else if (gapBuffer.length > 0) {
            const gapContent = gapBuffer.join("\n").trim();
            if (gapContent.length > MIN_CHARS / 2) {
                chunks.push(createChunk(
                    gapContent,
                    filePath,
                    null,
                    null,
                    chunkIndex++,
                    language,
                    gapStart,
                    gapStart + gapBuffer.length - 1,
                    null
                ));
            }
            gapBuffer = [];
        }
    }

    if (gapBuffer.length > 0) {
        const gapContent = gapBuffer.join("\n").trim();
        if (gapContent.length > MIN_CHARS / 2) {
            chunks.push(createChunk(
                gapContent,
                filePath,
                null,
                null,
                chunkIndex++,
                language,
                gapStart,
                gapStart + gapBuffer.length - 1,
                null
            ));
        }
    }

    return mergeSmallChunks(chunks, filePath, language);
}

function splitLargeSymbol(
    symbol: CodeSymbol,
    filePath: string,
    language: string,
    startIndex: number
): CodeChunk[] {
    const lines = symbol.content.split("\n");
    const chunks: CodeChunk[] = [];
    let currentLines: string[] = [];
    let currentStart = symbol.startLine;
    let idx = startIndex;

    const methodPattern = /^\s+(?:(?:public|private|protected|static|async|readonly)\s+)*(?:(?:get|set)\s+)?(\w+)\s*\(/;
    const defPattern = /^\s+def\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isMethodBoundary = methodPattern.test(line) || defPattern.test(line);
        const currentContent = currentLines.join("\n");

        if (isMethodBoundary && currentContent.length >= MIN_CHARS) {
            chunks.push(createChunk(
                currentContent.trim(),
                filePath,
                symbol.name,
                symbol.type,
                idx++,
                language,
                currentStart,
                currentStart + currentLines.length - 1,
                symbol.parentSymbol
            ));
            currentLines = [line];
            currentStart = symbol.startLine + i;
        } else {
            currentLines.push(line);
            if (currentLines.join("\n").length > MAX_CHARS) {
                chunks.push(createChunk(
                    currentContent.trim(),
                    filePath,
                    symbol.name,
                    symbol.type,
                    idx++,
                    language,
                    currentStart,
                    currentStart + currentLines.length - 2,
                    symbol.parentSymbol
                ));
                currentLines = [line];
                currentStart = symbol.startLine + i;
            }
        }
    }

    if (currentLines.length > 0) {
        const content = currentLines.join("\n").trim();
        if (content.length > 0) {
            chunks.push(createChunk(
                content,
                filePath,
                symbol.name,
                symbol.type,
                idx++,
                language,
                currentStart,
                currentStart + currentLines.length - 1,
                symbol.parentSymbol
            ));
        }
    }

    return chunks;
}

function chunkPlainText(content: string, filePath: string, language: string): CodeChunk[] {
    const lines = content.split("\n");
    const chunks: CodeChunk[] = [];
    let currentLines: string[] = [];
    let currentStart = 1;
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        currentLines.push(lines[i]);
        const currentContent = currentLines.join("\n");

        if (currentContent.length >= MAX_CHARS) {
            chunks.push(createChunk(
                currentContent.trim(),
                filePath,
                null,
                null,
                chunkIndex++,
                language,
                currentStart,
                currentStart + currentLines.length - 1,
                null
            ));
            currentLines = [];
            currentStart = i + 2;
        }
    }

    if (currentLines.length > 0) {
        const content_str = currentLines.join("\n").trim();
        if (content_str.length > 0) {
            chunks.push(createChunk(
                content_str,
                filePath,
                null,
                null,
                chunkIndex++,
                language,
                currentStart,
                currentStart + currentLines.length - 1,
                null
            ));
        }
    }

    return chunks;
}

function mergeSmallChunks(chunks: CodeChunk[], filePath: string, language: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const merged: CodeChunk[] = [];
    let buffer: CodeChunk | null = null;

    for (const chunk of chunks) {
        if (!buffer) {
            buffer = chunk;
            continue;
        }

        const combinedLength = buffer.content.length + chunk.content.length + 1;

        if (combinedLength <= MAX_CHARS && !buffer.symbolName && !chunk.symbolName) {
            buffer = {
                ...buffer,
                content: `${buffer.content}\n${chunk.content}`,
                endLine: chunk.endLine,
            };
        } else {
            merged.push(buffer);
            buffer = chunk;
        }
    }

    if (buffer) merged.push(buffer);

    return merged.map((c, i) => ({ ...c, chunkIndex: i }));
}

function createChunk(
    content: string,
    filePath: string,
    symbolName: string | null,
    symbolType: SymbolType | null,
    chunkIndex: number,
    language: string,
    startLine: number,
    endLine: number,
    parentStructure: string | null
): CodeChunk {
    return {
        content: `File: ${filePath}\nSymbol: ${symbolName || "none"}\nType: ${symbolType || "file-section"}\nLines: ${startLine}-${endLine}\nLanguage: ${language}\n---\n${content}`,
        filePath,
        symbolName,
        symbolType,
        chunkIndex,
        language,
        startLine,
        endLine,
        parentStructure,
        metadata: {
            filePath,
            symbolName,
            symbolType,
            language,
            startLine,
            endLine,
            parentStructure,
        },
    };
}
