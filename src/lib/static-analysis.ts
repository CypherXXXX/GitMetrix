import type { ParsedFile, DependencyEdge } from "./types";

export interface FileMetrics {
    filePath: string;
    language: string;
    lineCount: number;
    functionCount: number;
    avgFunctionLength: number;
    maxFunctionLength: number;
    maxCyclomaticComplexity: number;
    maxNestingDepth: number;
    importCount: number;
    exportCount: number;
    isGiantFile: boolean;
    riskScore: number;
}

export interface HealthReport {
    healthScore: number;
    totalFiles: number;
    fileMetrics: FileMetrics[];
    topRisks: FileMetrics[];
    summary: {
        giantFiles: number;
        highComplexity: number;
        deepNesting: number;
        avgRiskScore: number;
    };
}

const GIANT_FILE_THRESHOLD = 500;
const HIGH_COMPLEXITY_THRESHOLD = 10;
const DEEP_NESTING_THRESHOLD = 5;

function calculateCyclomaticComplexity(content: string): number {
    let complexity = 1;
    const branchPatterns = [
        /\bif\b/g, /\belse\s+if\b/g, /\bswitch\b/g, /\bcase\b/g,
        /\bfor\b/g, /\bwhile\b/g, /\bdo\b/g,
        /\bcatch\b/g, /\?\?/g, /\?\./g,
        /&&/g, /\|\|/g, /\?[^?.]/g,
    ];

    for (const pattern of branchPatterns) {
        const matches = content.match(pattern);
        if (matches) complexity += matches.length;
    }

    return complexity;
}

function calculateNestingDepth(content: string): number {
    const lines = content.split("\n");
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
        for (const ch of line) {
            if (ch === "{" || ch === "(" || ch === "[") {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (ch === "}" || ch === ")" || ch === "]") {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }
    }

    return maxDepth;
}

function analyzeFile(parsedFile: ParsedFile): FileMetrics {
    const { filePath, language, symbols, imports, exports, lineCount, content } = parsedFile;

    const functions = symbols.filter(
        (s) => s.type === "function" || s.type === "method"
    );

    const functionLengths = functions.map((f) => f.endLine - f.startLine + 1);
    const avgFunctionLength = functionLengths.length > 0
        ? functionLengths.reduce((a, b) => a + b, 0) / functionLengths.length
        : 0;
    const maxFunctionLength = functionLengths.length > 0
        ? Math.max(...functionLengths)
        : 0;

    const maxComplexity = functions.length > 0
        ? Math.max(
            ...functions.map((f) => calculateCyclomaticComplexity(f.content))
        )
        : calculateCyclomaticComplexity(content);

    const maxNesting = calculateNestingDepth(content);
    const isGiant = lineCount > GIANT_FILE_THRESHOLD;

    let riskScore = 0;
    if (isGiant) riskScore += 20;
    if (maxComplexity > HIGH_COMPLEXITY_THRESHOLD) riskScore += 25;
    if (maxNesting > DEEP_NESTING_THRESHOLD) riskScore += 15;
    if (maxFunctionLength > 100) riskScore += 15;
    if (functionLengths.length > 0 && avgFunctionLength > 50) riskScore += 10;
    riskScore += Math.min(15, (imports.length / 20) * 15);

    return {
        filePath,
        language,
        lineCount,
        functionCount: functions.length,
        avgFunctionLength: Math.round(avgFunctionLength * 10) / 10,
        maxFunctionLength,
        maxCyclomaticComplexity: maxComplexity,
        maxNestingDepth: maxNesting,
        importCount: imports.length,
        exportCount: exports.length,
        isGiantFile: isGiant,
        riskScore: Math.min(100, Math.round(riskScore)),
    };
}

export function analyzeRepository(
    parsedFiles: ParsedFile[],
    _edges?: DependencyEdge[]
): HealthReport {
    const fileMetrics = parsedFiles.map(analyzeFile);

    const giantFiles = fileMetrics.filter((m) => m.isGiantFile).length;
    const highComplexity = fileMetrics.filter(
        (m) => m.maxCyclomaticComplexity > HIGH_COMPLEXITY_THRESHOLD
    ).length;
    const deepNesting = fileMetrics.filter(
        (m) => m.maxNestingDepth > DEEP_NESTING_THRESHOLD
    ).length;
    const avgRiskScore = fileMetrics.length > 0
        ? Math.round(
            fileMetrics.reduce((a, b) => a + b.riskScore, 0) / fileMetrics.length
        )
        : 0;

    const topRisks = [...fileMetrics]
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10);

    const healthScore = Math.max(0, Math.min(100, 100 - avgRiskScore));

    return {
        healthScore,
        totalFiles: fileMetrics.length,
        fileMetrics,
        topRisks,
        summary: {
            giantFiles,
            highComplexity,
            deepNesting,
            avgRiskScore,
        },
    };
}
