import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { RepositoryStatusSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
    try {
        const repositoryId = request.nextUrl.searchParams.get("repositoryId");

        const validation = RepositoryStatusSchema.safeParse({ repositoryId });

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const { data: repository, error } = await supabase
            .from("repositories")
            .select("id, status, file_count, total_files_discovered, total_files_processed, total_chunks, total_vectors, languages_json, error_message")
            .eq("id", validation.data.repositoryId)
            .single();

        if (error || !repository) {
            return NextResponse.json(
                { error: "Repository not found" },
                { status: 404 }
            );
        }

        const discovered = repository.total_files_discovered || 0;
        const processed = repository.total_files_processed || 0;
        const progress = discovered > 0 ? Math.round((processed / discovered) * 100) : 0;

        return NextResponse.json({
            repositoryId: repository.id,
            status: repository.status,
            fileCount: repository.file_count || 0,
            totalFilesDiscovered: discovered,
            totalFilesProcessed: processed,
            totalChunks: repository.total_chunks || 0,
            totalVectors: repository.total_vectors || 0,
            languages: repository.languages_json || {},
            progress,
            error: repository.error_message,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
