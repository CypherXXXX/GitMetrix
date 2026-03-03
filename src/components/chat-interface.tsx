"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, FileReference, IndexingStatus } from "@/lib/types";
import {
    Send,
    Loader2,
    MessageSquareCode,
    FileCode2,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Database,
    Bot,
    User,
    RotateCcw,
    Sparkles,
    Globe,
} from "lucide-react";
import { RepoSelector } from "@/components/repo-selector";

type ChatPhase = "select" | "input" | "indexing" | "chatting";

interface StreamEvent {
    type: "references" | "content" | "done" | "error";
    data?: string;
}

interface ExtendedIndexingStatus extends IndexingStatus {
    chunksProcessed?: number;
}

function FileReferenceTag({ filePath }: { filePath: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/15">
            <FileCode2 className="h-3 w-3" />
            {filePath}
        </span>
    );
}

function MarkdownRenderer({ content }: { content: string }) {
    const renderInlineMarkdown = (text: string): React.ReactNode[] => {
        const nodes: React.ReactNode[] = [];
        let remaining = text;
        let key = 0;

        while (remaining.length > 0) {
            const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
            const codeMatch = remaining.match(/`([^`]+)`/);
            const fileRefMatch = remaining.match(/\[file:([^\]]+)\]/);

            let firstMatch: { type: string; index: number; full: string; inner: string } | null = null;

            if (boldMatch && boldMatch.index !== undefined) {
                firstMatch = { type: "bold", index: boldMatch.index, full: boldMatch[0], inner: boldMatch[1] };
            }
            if (codeMatch && codeMatch.index !== undefined) {
                if (!firstMatch || codeMatch.index < firstMatch.index) {
                    firstMatch = { type: "code", index: codeMatch.index, full: codeMatch[0], inner: codeMatch[1] };
                }
            }
            if (fileRefMatch && fileRefMatch.index !== undefined) {
                if (!firstMatch || fileRefMatch.index < firstMatch.index) {
                    firstMatch = { type: "fileRef", index: fileRefMatch.index, full: fileRefMatch[0], inner: fileRefMatch[1] };
                }
            }

            if (!firstMatch) {
                nodes.push(<span key={key++}>{remaining}</span>);
                break;
            }

            if (firstMatch.index > 0) {
                nodes.push(<span key={key++}>{remaining.slice(0, firstMatch.index)}</span>);
            }

            if (firstMatch.type === "bold") {
                nodes.push(<strong key={key++} className="font-semibold text-white">{firstMatch.inner}</strong>);
            } else if (firstMatch.type === "code") {
                nodes.push(
                    <code key={key++} className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] font-mono text-indigo-300">
                        {firstMatch.inner}
                    </code>
                );
            } else if (firstMatch.type === "fileRef") {
                nodes.push(<FileReferenceTag key={key++} filePath={firstMatch.inner} />);
            }

            remaining = remaining.slice(firstMatch.index + firstMatch.full.length);
        }

        return nodes;
    };

    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith("```")) {
            const lang = line.slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            i++;
            elements.push(
                <div key={key++} className="my-3 overflow-hidden rounded-xl border border-white/6">
                    {lang && (
                        <div className="flex items-center gap-2 border-b border-white/6 bg-white/3 px-4 py-2">
                            <FileCode2 className="h-3 w-3 text-zinc-500" />
                            <span className="text-[11px] font-medium text-zinc-500">{lang}</span>
                        </div>
                    )}
                    <pre className="overflow-x-auto bg-void/60 p-4 text-[13px] leading-relaxed">
                        <code className="font-mono text-zinc-300">{codeLines.join("\n")}</code>
                    </pre>
                </div>
            );
            continue;
        }

        if (line.startsWith("### ")) {
            elements.push(<h3 key={key++} className="mb-1 mt-4 text-sm font-semibold text-white">{renderInlineMarkdown(line.slice(4))}</h3>);
        } else if (line.startsWith("## ")) {
            elements.push(<h2 key={key++} className="mb-1 mt-4 text-base font-semibold text-white">{renderInlineMarkdown(line.slice(3))}</h2>);
        } else if (line.startsWith("# ")) {
            elements.push(<h1 key={key++} className="mb-2 mt-4 text-lg font-bold text-white">{renderInlineMarkdown(line.slice(2))}</h1>);
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            elements.push(
                <div key={key++} className="flex gap-2 py-0.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400/60" />
                    <span>{renderInlineMarkdown(line.slice(2))}</span>
                </div>
            );
        } else if (/^\d+\.\s/.test(line)) {
            const num = line.match(/^(\d+)\.\s/)?.[1];
            const text = line.replace(/^\d+\.\s/, "");
            elements.push(
                <div key={key++} className="flex gap-2 py-0.5">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-indigo-400/60">{num}.</span>
                    <span>{renderInlineMarkdown(text)}</span>
                </div>
            );
        } else if (line.trim() === "") {
            elements.push(<div key={key++} className="h-2" />);
        } else {
            elements.push(<p key={key++} className="py-0.5">{renderInlineMarkdown(line)}</p>);
        }
        i++;
    }

    return <div className="space-y-0.5">{elements}</div>;
}

function SuggestionCard({ question, onClick }: { question: string; onClick: () => void }) {
    return (
        <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className="group flex w-full items-start gap-3 rounded-xl border border-white/5 bg-white/2 p-3.5 text-left transition-all duration-200 hover:border-indigo-500/25 hover:bg-indigo-500/5 sm:p-4"
        >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400/50 transition-colors group-hover:text-indigo-400" />
            <span className="text-[13px] leading-snug text-zinc-400 transition-colors group-hover:text-zinc-200">
                {question}
            </span>
        </motion.button>
    );
}

function IndexingProgress({ status }: { status: ExtendedIndexingStatus | null }) {
    if (!status) {
        return (
            <div className="flex flex-col items-center gap-3">
                <div className="h-1.5 w-52 overflow-hidden rounded-full bg-zinc-800/80 sm:w-64">
                    <div className="skeleton-shimmer h-full w-full rounded-full" />
                </div>
                <p className="text-xs text-zinc-600">Preparing...</p>
            </div>
        );
    }

    const icons = {
        pending: <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />,
        indexing: <Database className="h-5 w-5 animate-pulse text-indigo-400" />,
        completed: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
        failed: <AlertCircle className="h-5 w-5 text-red-400" />,
    };

    const messages = {
        pending: "Starting indexing...",
        indexing: status.chunksProcessed
            ? `Processing: ${status.chunksProcessed} chunks indexed`
            : `Indexing ${status.fileCount || 0} files...`,
        completed: `Done — ${status.fileCount || 0} files indexed`,
        failed: status.error || "Indexing failed",
    };

    return (
        <div className="flex flex-col items-center gap-3">
            {icons[status.status as keyof typeof icons]}
            {status.status === "indexing" && (
                <div className="h-1.5 w-52 overflow-hidden rounded-full bg-zinc-800/80 sm:w-64">
                    <motion.div
                        className="h-full rounded-full bg-linear-to-r from-indigo-500 to-purple-500"
                        initial={{ width: "5%" }}
                        animate={{ width: "85%" }}
                        transition={{ duration: 30, ease: "linear" }}
                    />
                </div>
            )}
            <p className={`text-xs ${status.status === "failed" ? "text-red-400" : "text-zinc-500"}`}>
                {messages[status.status as keyof typeof messages]}
            </p>
        </div>
    );
}

interface ChatInterfaceProps {
    username?: string;
}

export function ChatInterface({ username }: ChatInterfaceProps) {
    const [phase, setPhase] = useState<ChatPhase>(username ? "select" : "input");
    const [repoUrl, setRepoUrl] = useState("");
    const [repositoryId, setRepositoryId] = useState<string | null>(null);
    const [indexingStatus, setIndexingStatus] = useState<ExtendedIndexingStatus | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleTextareaInput = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, []);

    async function fetchSuggestions(repoId: string) {
        try {
            const response = await fetch(`/api/chat/suggestions?repositoryId=${repoId}`);
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.suggestions || []);
            }
        } catch { }
    }

    function startPolling(repoId: string) {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            try {
                const response = await fetch(`/api/index/status?repositoryId=${repoId}`);
                const data = await response.json();

                if (!response.ok) return;

                setIndexingStatus({
                    repositoryId: repoId,
                    status: data.status,
                    fileCount: data.fileCount || 0,
                    progress: data.status === "completed" ? 100 : data.status === "indexing" ? 50 : 0,
                    error: data.error || null,
                    chunksProcessed: data.chunksProcessed || 0,
                });

                if (data.status === "completed" || data.status === "failed") {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    if (data.status === "completed") {
                        await fetchSuggestions(repoId);
                        setTimeout(() => setPhase("chatting"), 1500);
                    }
                    if (data.status === "failed") {
                        setError(data.error || "Indexing failed");
                    }
                }
            } catch { }
        }, 3000);
    }

    async function handleSendMessage(overrideMessage?: string) {
        const msgText = overrideMessage || inputMessage.trim();
        if (!msgText || isStreaming || !repositoryId) return;

        const userMessage: ChatMessage = { role: "user", content: msgText };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage("");
        setIsStreaming(true);
        setError(null);

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        const assistantMessage: ChatMessage = {
            role: "assistant",
            content: "",
            fileReferences: [],
        };
        setMessages(prev => [...prev, assistantMessage]);

        try {
            const history = messages.slice(-10).map((m) => ({
                role: m.role,
                content: m.content,
            }));

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repositoryId,
                    message: msgText,
                    history,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Request failed (${response.status})`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response stream");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const rawLine of lines) {
                    const line = rawLine.startsWith("data: ") ? rawLine.slice(6) : rawLine;
                    if (!line.trim()) continue;
                    try {
                        const event: StreamEvent = JSON.parse(line);

                        if (event.type === "references" && event.data) {
                            const refs: FileReference[] = JSON.parse(event.data);
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = { ...updated[updated.length - 1] };
                                last.fileReferences = refs;
                                updated[updated.length - 1] = last;
                                return updated;
                            });
                        } else if (event.type === "content" && event.data) {
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = { ...updated[updated.length - 1] };
                                last.content = (last.content || "") + event.data;
                                updated[updated.length - 1] = last;
                                return updated;
                            });
                        } else if (event.type === "error") {
                            throw new Error(event.data || "Stream error");
                        }
                    } catch (e) {
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send message");
            setMessages(prev => {
                const filtered = prev.filter(m => m.content || m.role === "user");
                return filtered;
            });
        } finally {
            setIsStreaming(false);
        }
    }

    async function handleStartIndexing() {
        if (!repoUrl.trim()) return;

        setError(null);
        setPhase("indexing");

        try {
            const response = await fetch("/api/index", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repoUrl }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to start indexing");

            setRepositoryId(data.repositoryId);

            if (data.status === "completed") {
                setIndexingStatus({
                    status: "completed",
                    progress: 100,
                    fileCount: 0,
                    error: null,
                    repositoryId: data.repositoryId,
                });
                await fetchSuggestions(data.repositoryId);
                setTimeout(() => setPhase("chatting"), 1000);
                return;
            }

            startPolling(data.repositoryId);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to start indexing");
            setPhase("input");
        }
    }

    function handleReset() {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPhase(username ? "select" : "input");
        setRepoUrl("");
        setRepositoryId(null);
        setIndexingStatus(null);
        setMessages([]);
        setInputMessage("");
        setError(null);
        setSuggestions([]);
    }

    function handleSelectRepo(url: string) {
        setRepoUrl(url);
        setError(null);
        setPhase("indexing");

        (async () => {
            try {
                const response = await fetch("/api/index", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ repoUrl: url }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Failed to start indexing");
                setRepositoryId(data.repositoryId);
                if (data.status === "completed") {
                    setIndexingStatus({
                        status: "completed",
                        progress: 100,
                        fileCount: 0,
                        error: null,
                        repositoryId: data.repositoryId,
                    });
                    await fetchSuggestions(data.repositoryId);
                    setTimeout(() => setPhase("chatting"), 1000);
                    return;
                }
                startPolling(data.repositoryId);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to start indexing");
                setPhase(username ? "select" : "input");
            }
        })();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col sm:h-[calc(100vh-4rem)]">
            <AnimatePresence mode="wait">
                {phase === "select" && username && (
                    <motion.div
                        key="select"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-1 flex-col"
                    >
                        <RepoSelector username={username} onSelectRepo={handleSelectRepo} />
                    </motion.div>
                )}

                {phase === "input" && (
                    <motion.div
                        key="input"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-1 flex-col items-center justify-center gap-6 px-4 sm:gap-8"
                    >
                        <div className="flex flex-col items-center gap-3 sm:gap-4">
                            <div className="animate-float rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3.5">
                                <Globe className="h-8 w-8 text-indigo-400 sm:h-10 sm:w-10" />
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                                Chat with Any Repository
                            </h2>
                            <p className="max-w-sm text-center text-xs text-zinc-500 sm:max-w-md sm:text-sm">
                                Paste a GitHub URL to index and start chatting with the codebase
                            </p>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5"
                            >
                                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                <span className="text-xs text-red-400">{error}</span>
                            </motion.div>
                        )}

                        <div className="w-full max-w-lg">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleStartIndexing();
                                    }}
                                    placeholder="https://github.com/owner/repository"
                                    className="h-12 w-full rounded-xl border border-white/6 bg-white/3 pl-4 pr-12 text-sm text-white placeholder-zinc-600 backdrop-blur-xl outline-none transition-all duration-200 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 sm:h-14 sm:pl-5 sm:pr-14"
                                    autoFocus
                                />
                                <button
                                    onClick={() => handleStartIndexing()}
                                    disabled={!repoUrl.trim()}
                                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-linear-to-r from-indigo-500 to-purple-600 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-30 disabled:hover:scale-100 sm:right-2 sm:h-10 sm:w-10 sm:rounded-xl"
                                >
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {phase === "indexing" && (
                    <motion.div
                        key="indexing"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-1 flex-col items-center justify-center gap-5 px-4 sm:gap-6"
                    >
                        <div className="animate-float rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3.5">
                            <Database className="h-8 w-8 text-indigo-400 sm:h-10 sm:w-10" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-lg font-semibold text-white sm:text-xl">
                                Indexing Repository
                            </h2>
                            <p className="mt-1.5 max-w-sm text-xs text-zinc-500 sm:max-w-md sm:text-sm">
                                Fetching, chunking, and embedding the codebase
                            </p>
                        </div>
                        <IndexingProgress status={indexingStatus} />
                        {indexingStatus?.status === "failed" && (
                            <button
                                onClick={() => {
                                    setIndexingStatus(null);
                                    setError(null);
                                    setRepositoryId(null);
                                    handleStartIndexing();
                                }}
                                className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/3 px-5 py-2.5 text-xs font-medium text-zinc-300 transition-all duration-200 hover:bg-white/6"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Retry
                            </button>
                        )}
                    </motion.div>
                )}

                {phase === "chatting" && (
                    <motion.div
                        key="chatting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-1 flex-col overflow-hidden"
                    >
                        <div className="flex items-center justify-between border-b border-white/6 px-3 py-2.5 sm:px-6 sm:py-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <MessageSquareCode className="h-4 w-4 text-indigo-400" />
                                <span className="max-w-[150px] truncate text-xs font-medium text-white sm:max-w-none sm:text-sm">
                                    {repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "")}
                                </span>
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                    Indexed
                                </span>
                            </div>
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1.5 rounded-lg border border-white/6 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white sm:px-3 sm:text-xs"
                            >
                                <RotateCcw className="h-3 w-3" />
                                <span className="hidden sm:inline">New Repo</span>
                                <span className="sm:hidden">New</span>
                            </button>
                        </div>

                        <div className="chat-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
                            {messages.length === 0 && (
                                <div className="flex h-full flex-col items-center justify-center gap-5 text-center sm:gap-6">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="rounded-2xl border border-white/5 bg-white/2 p-3">
                                            <Bot className="h-7 w-7 text-indigo-400/80 sm:h-8 sm:w-8" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-300">
                                                Repository indexed and ready
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-600">
                                                Ask anything about the codebase
                                            </p>
                                        </div>
                                    </div>

                                    {suggestions.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="grid w-full max-w-xl gap-2 sm:gap-3"
                                        >
                                            {suggestions.map((question, idx) => (
                                                <SuggestionCard
                                                    key={idx}
                                                    question={question}
                                                    onClick={() => handleSendMessage(question)}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
                                {messages.map((message, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className={`flex gap-2.5 sm:gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {message.role === "assistant" && (
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-purple-600">
                                                <Bot className="h-3.5 w-3.5 text-white" />
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[80%] sm:px-4 sm:py-3 ${message.role === "user"
                                                ? "bg-linear-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 text-white"
                                                : "bg-white/3 border border-white/6 text-zinc-200"
                                                }`}
                                        >
                                            {message.role === "assistant" &&
                                                message.fileReferences &&
                                                message.fileReferences.length > 0 && (
                                                    <div className="mb-3 flex flex-wrap gap-1.5">
                                                        {message.fileReferences.map((ref, refIndex) => (
                                                            <FileReferenceTag key={refIndex} filePath={ref.filePath} />
                                                        ))}
                                                    </div>
                                                )}
                                            <div className="text-[13px] leading-relaxed sm:text-sm">
                                                {message.role === "assistant" ? (
                                                    <>
                                                        <MarkdownRenderer content={message.content} />
                                                        {isStreaming &&
                                                            index === messages.length - 1 &&
                                                            !message.content && (
                                                                <span className="inline-flex gap-1">
                                                                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                                                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-indigo-400" style={{ animationDelay: "0.15s" }} />
                                                                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-indigo-400" style={{ animationDelay: "0.3s" }} />
                                                                </span>
                                                            )}
                                                    </>
                                                ) : (
                                                    <span className="whitespace-pre-wrap">{message.content}</span>
                                                )}
                                            </div>
                                        </div>
                                        {message.role === "user" && (
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                                                <User className="h-3.5 w-3.5 text-zinc-400" />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        <div className="border-t border-white/6 bg-void/80 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
                            <div className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3">
                                <textarea
                                    ref={textareaRef}
                                    value={inputMessage}
                                    onChange={(e) => {
                                        setInputMessage(e.target.value);
                                        handleTextareaInput();
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about the codebase..."
                                    rows={1}
                                    className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-white/6 bg-white/3 px-3.5 py-2.5 text-[13px] text-white placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/40 sm:min-h-[44px] sm:px-4 sm:py-3 sm:text-sm"
                                />
                                <button
                                    onClick={() => handleSendMessage()}
                                    disabled={!inputMessage.trim() || isStreaming}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-30 disabled:hover:scale-100 sm:h-[44px] sm:w-[44px]"
                                >
                                    {isStreaming ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
