import type {
    CodeSymbol,
    ImportStatement,
    ExportStatement,
    ParsedFile,
    SymbolType,
    SUPPORTED_EXTENSIONS,
} from "./types";

const EXTENSION_MAP: Record<string, string> = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".dart": "dart",
    ".ex": "elixir",
    ".exs": "elixir",
    ".zig": "zig",
    ".lua": "lua",
    ".html": "html",
    ".css": "css",
    ".scss": "css",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".mdx": "markdown",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".vue": "vue",
    ".svelte": "svelte",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".proto": "protobuf",
    ".toml": "toml",
    ".xml": "xml",
    ".tf": "terraform",
};

export function detectLanguage(filePath: string): string {
    const lastDot = filePath.lastIndexOf(".");
    if (lastDot === -1) return "unknown";
    const ext = filePath.slice(lastDot).toLowerCase();
    return EXTENSION_MAP[ext] || "unknown";
}

export function parseFile(content: string, filePath: string): ParsedFile {
    const language = detectLanguage(filePath);
    const lines = content.split("\n");
    const symbols = extractSymbols(content, filePath, language);
    const imports = extractImports(content, language);
    const exports = extractExports(content, language);

    return {
        filePath,
        language,
        content,
        symbols,
        imports,
        exports,
        fileSize: content.length,
        lineCount: lines.length,
    };
}

function extractSymbols(
    content: string,
    filePath: string,
    language: string
): CodeSymbol[] {
    switch (language) {
        case "typescript":
        case "javascript":
            return extractTSJSSymbols(content, language);
        case "python":
            return extractPythonSymbols(content);
        case "java":
        case "kotlin":
        case "scala":
            return extractJavaLikeSymbols(content, language);
        case "go":
            return extractGoSymbols(content);
        case "rust":
            return extractRustSymbols(content);
        case "c":
        case "cpp":
            return extractCCppSymbols(content, language);
        case "ruby":
            return extractRubySymbols(content);
        case "php":
            return extractPHPSymbols(content);
        default:
            return extractGenericSymbols(content, language);
    }
}

function findBlockEnd(lines: string[], startLine: number, openChar: string, closeChar: string): number {
    let depth = 0;
    let found = false;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
            if (ch === openChar) {
                depth++;
                found = true;
            } else if (ch === closeChar) {
                depth--;
                if (found && depth === 0) return i;
            }
        }
    }
    return Math.min(startLine + 50, lines.length - 1);
}

function findIndentBlockEnd(lines: string[], startLine: number): number {
    if (startLine >= lines.length - 1) return startLine;
    const baseIndent = lines[startLine].search(/\S/);
    for (let i = startLine + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "") continue;
        const indent = line.search(/\S/);
        if (indent <= baseIndent) return i - 1;
    }
    return lines.length - 1;
}

function extractTSJSSymbols(content: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: "function" },
        { regex: /^(?:export\s+)?class\s+(\w+)/, type: "class" },
        { regex: /^(?:export\s+)?interface\s+(\w+)/, type: "interface" },
        { regex: /^(?:export\s+)?type\s+(\w+)\s*=/, type: "type_alias" },
        { regex: /^(?:export\s+)?enum\s+(\w+)/, type: "enum" },
        { regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/, type: "function" },
        { regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/, type: "function" },
        { regex: /^\s+(?:public|private|protected|static|async|readonly)\s+(?:async\s+)?(\w+)\s*\(/, type: "method" },
        { regex: /^\s+(?:get|set)\s+(\w+)\s*\(/, type: "method" },
    ];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        for (const { regex, type } of patterns) {
            const match = trimmed.match(regex);
            if (match) {
                const name = match[1];
                const endLine = findBlockEnd(lines, i, "{", "}");
                const symbolContent = lines.slice(i, endLine + 1).join("\n");
                symbols.push({
                    name,
                    type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language,
                    parentSymbol: null,
                    content: symbolContent,
                });
                break;
            }
        }
    }

    return resolveParentSymbols(symbols);
}

function extractPythonSymbols(content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^(\s*)def\s+(\w+)\s*\(/, type: "function" },
        { regex: /^(\s*)class\s+(\w+)/, type: "class" },
        { regex: /^(\s*)@(\w+)/, type: "decorator" },
    ];

    for (let i = 0; i < lines.length; i++) {
        for (const { regex, type } of patterns) {
            const match = lines[i].match(regex);
            if (match) {
                if (type === "decorator") continue;
                const name = match[2];
                const endLine = findIndentBlockEnd(lines, i);
                const symbolContent = lines.slice(i, endLine + 1).join("\n");
                symbols.push({
                    name,
                    type: type === "function" && (match[1] || "").length > 0 ? "method" : type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language: "python",
                    parentSymbol: null,
                    content: symbolContent,
                });
                break;
            }
        }
    }

    return resolveParentSymbols(symbols);
}

function extractJavaLikeSymbols(content: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(\w+)/, type: "class" },
        { regex: /^(?:public|private|protected)?\s*(?:static\s+)?interface\s+(\w+)/, type: "interface" },
        { regex: /^(?:public|private|protected)?\s*(?:static\s+)?enum\s+(\w+)/, type: "enum" },
        { regex: /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:abstract\s+)?(?:\w+(?:<[^>]*>)?(?:\[\])*)\s+(\w+)\s*\(/, type: "method" },
    ];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        for (const { regex, type } of patterns) {
            const match = trimmed.match(regex);
            if (match) {
                const name = match[1];
                const endLine = findBlockEnd(lines, i, "{", "}");
                symbols.push({
                    name,
                    type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language,
                    parentSymbol: null,
                    content: lines.slice(i, endLine + 1).join("\n"),
                });
                break;
            }
        }
    }

    return resolveParentSymbols(symbols);
}

function extractGoSymbols(content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(\w+)\s*\(/, type: "function" },
        { regex: /^type\s+(\w+)\s+struct\b/, type: "struct" },
        { regex: /^type\s+(\w+)\s+interface\b/, type: "interface" },
        { regex: /^type\s+(\w+)\s+/, type: "type_alias" },
    ];

    for (let i = 0; i < lines.length; i++) {
        for (const { regex, type } of patterns) {
            const match = lines[i].match(regex);
            if (match) {
                const name = match[1];
                const endLine = findBlockEnd(lines, i, "{", "}");
                const isMeth = /^func\s+\(/.test(lines[i]);
                symbols.push({
                    name,
                    type: isMeth ? "method" : type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language: "go",
                    parentSymbol: null,
                    content: lines.slice(i, endLine + 1).join("\n"),
                });
                break;
            }
        }
    }

    return symbols;
}

function extractRustSymbols(content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, type: "function" },
        { regex: /^(?:pub\s+)?struct\s+(\w+)/, type: "struct" },
        { regex: /^(?:pub\s+)?enum\s+(\w+)/, type: "enum" },
        { regex: /^(?:pub\s+)?trait\s+(\w+)/, type: "trait" },
        { regex: /^impl(?:<[^>]*>)?\s+(\w+)/, type: "class" },
        { regex: /^(?:pub\s+)?mod\s+(\w+)/, type: "module" },
    ];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        for (const { regex, type } of patterns) {
            const match = trimmed.match(regex);
            if (match) {
                const name = match[1];
                const endLine = findBlockEnd(lines, i, "{", "}");
                symbols.push({
                    name,
                    type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language: "rust",
                    parentSymbol: null,
                    content: lines.slice(i, endLine + 1).join("\n"),
                });
                break;
            }
        }
    }

    return resolveParentSymbols(symbols);
}

function extractCCppSymbols(content: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^(?:class|struct)\s+(\w+)/, type: "class" },
        { regex: /^namespace\s+(\w+)/, type: "namespace" },
        { regex: /^(?:static\s+)?(?:inline\s+)?(?:virtual\s+)?(?:const\s+)?(?:\w+(?:::\w+)*(?:\s*[*&])?)\s+(\w+)\s*\(/, type: "function" },
        { regex: /^(?:typedef)\s+.*\s+(\w+)\s*;/, type: "type_alias" },
    ];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        for (const { regex, type } of patterns) {
            const match = trimmed.match(regex);
            if (match) {
                const name = match[1];
                const endLine = findBlockEnd(lines, i, "{", "}");
                symbols.push({
                    name,
                    type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language,
                    parentSymbol: null,
                    content: lines.slice(i, endLine + 1).join("\n"),
                });
                break;
            }
        }
    }

    return resolveParentSymbols(symbols);
}

function extractRubySymbols(content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        let match = trimmed.match(/^(?:def)\s+(?:self\.)?(\w+[?!]?)/);
        if (match) {
            const endLine = findRubyBlockEnd(lines, i);
            symbols.push({
                name: match[1],
                type: "function",
                startLine: i + 1,
                endLine: endLine + 1,
                language: "ruby",
                parentSymbol: null,
                content: lines.slice(i, endLine + 1).join("\n"),
            });
            continue;
        }
        match = trimmed.match(/^(?:class|module)\s+(\w+)/);
        if (match) {
            const endLine = findRubyBlockEnd(lines, i);
            symbols.push({
                name: match[1],
                type: trimmed.startsWith("module") ? "module" : "class",
                startLine: i + 1,
                endLine: endLine + 1,
                language: "ruby",
                parentSymbol: null,
                content: lines.slice(i, endLine + 1).join("\n"),
            });
        }
    }

    return resolveParentSymbols(symbols);
}

function findRubyBlockEnd(lines: string[], startLine: number): number {
    let depth = 0;
    const openers = /\b(def|class|module|if|unless|while|until|for|case|begin|do)\b/;
    for (let i = startLine; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        if (openers.test(trimmed)) depth++;
        if (/^\s*end\b/.test(lines[i])) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return Math.min(startLine + 50, lines.length - 1);
}

function extractPHPSymbols(content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const patterns: Array<{ regex: RegExp; type: SymbolType }> = [
        { regex: /^(?:public|private|protected|static)?\s*function\s+(\w+)\s*\(/, type: "function" },
        { regex: /^(?:abstract\s+)?class\s+(\w+)/, type: "class" },
        { regex: /^interface\s+(\w+)/, type: "interface" },
        { regex: /^trait\s+(\w+)/, type: "trait" },
    ];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        for (const { regex, type } of patterns) {
            const match = trimmed.match(regex);
            if (match) {
                const endLine = findBlockEnd(lines, i, "{", "}");
                symbols.push({
                    name: match[1],
                    type,
                    startLine: i + 1,
                    endLine: endLine + 1,
                    language: "php",
                    parentSymbol: null,
                    content: lines.slice(i, endLine + 1).join("\n"),
                });
                break;
            }
        }
    }

    return resolveParentSymbols(symbols);
}

function extractGenericSymbols(content: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    const funcPattern = /^(?:export\s+)?(?:async\s+)?(?:function|func|fn|def|sub|proc)\s+(\w+)/;
    const classPattern = /^(?:export\s+)?(?:class|struct|interface|trait|module|type)\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        let match = trimmed.match(funcPattern);
        if (match) {
            const endLine = findBlockEnd(lines, i, "{", "}");
            symbols.push({
                name: match[1],
                type: "function",
                startLine: i + 1,
                endLine: endLine + 1,
                language,
                parentSymbol: null,
                content: lines.slice(i, endLine + 1).join("\n"),
            });
            continue;
        }
        match = trimmed.match(classPattern);
        if (match) {
            const endLine = findBlockEnd(lines, i, "{", "}");
            symbols.push({
                name: match[1],
                type: "class",
                startLine: i + 1,
                endLine: endLine + 1,
                language,
                parentSymbol: null,
                content: lines.slice(i, endLine + 1).join("\n"),
            });
        }
    }

    return symbols;
}

function resolveParentSymbols(symbols: CodeSymbol[]): CodeSymbol[] {
    for (let i = 0; i < symbols.length; i++) {
        for (let j = 0; j < symbols.length; j++) {
            if (i === j) continue;
            const inner = symbols[i];
            const outer = symbols[j];
            if (
                inner.startLine > outer.startLine &&
                inner.endLine <= outer.endLine &&
                (outer.type === "class" || outer.type === "struct" || outer.type === "module" || outer.type === "namespace" || outer.type === "trait")
            ) {
                inner.parentSymbol = outer.name;
                if (inner.type === "function") {
                    inner.type = "method";
                }
            }
        }
    }
    return symbols;
}

function extractImports(content: string, language: string): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (language === "typescript" || language === "javascript") {
            let match = line.match(/^import\s+(\w+)\s+from\s+["']([^"']+)["']/);
            if (match) {
                imports.push({ source: match[2], specifiers: [match[1]], line: i + 1, isDefault: true, isNamespace: false });
                continue;
            }
            match = line.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/);
            if (match) {
                imports.push({ source: match[2], specifiers: [match[1]], line: i + 1, isDefault: false, isNamespace: true });
                continue;
            }
            match = line.match(/^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/);
            if (match) {
                const specs = match[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
                imports.push({ source: match[2], specifiers: specs, line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
            match = line.match(/^import\s+["']([^"']+)["']/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
            match = line.match(/require\s*\(\s*["']([^"']+)["']\s*\)/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }

        if (language === "python") {
            let match = line.match(/^from\s+(\S+)\s+import\s+(.+)/);
            if (match) {
                const specs = match[2].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
                imports.push({ source: match[1], specifiers: specs, line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
            match = line.match(/^import\s+(\S+)/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: true });
                continue;
            }
        }

        if (language === "go") {
            const match = line.match(/^\s*"([^"]+)"/);
            if (match && i > 0 && /import/.test(lines.slice(Math.max(0, i - 5), i).join("\n"))) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }

        if (language === "java" || language === "kotlin" || language === "scala") {
            const match = line.match(/^import\s+(?:static\s+)?([^\s;]+)/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }

        if (language === "rust") {
            const match = line.match(/^use\s+([^\s;]+)/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }

        if (language === "c" || language === "cpp") {
            const match = line.match(/^#include\s+["<]([^">]+)[">]/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }

        if (language === "ruby") {
            const match = line.match(/^require(?:_relative)?\s+["']([^"']+)["']/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }

        if (language === "php") {
            const match = line.match(/^use\s+([^\s;]+)/);
            if (match) {
                imports.push({ source: match[1], specifiers: [], line: i + 1, isDefault: false, isNamespace: false });
                continue;
            }
        }
    }

    return imports;
}

function extractExports(content: string, language: string): ExportStatement[] {
    const exports: ExportStatement[] = [];
    const lines = content.split("\n");

    if (language !== "typescript" && language !== "javascript") return exports;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^export\s+default\s+/.test(line)) {
            const match = line.match(/^export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)?/);
            exports.push({
                name: match?.[1] || "default",
                line: i + 1,
                isDefault: true,
            });
            continue;
        }

        if (/^export\s+(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+/.test(line)) {
            const match = line.match(/^export\s+(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/);
            if (match) {
                exports.push({ name: match[1], line: i + 1, isDefault: false });
            }
            continue;
        }

        const namedExport = line.match(/^export\s+\{([^}]+)\}/);
        if (namedExport) {
            const names = namedExport[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
            for (const name of names) {
                exports.push({ name, line: i + 1, isDefault: false });
            }
        }
    }

    return exports;
}
