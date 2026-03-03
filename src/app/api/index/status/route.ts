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
            .select("id, status, file_count, error_message")
            .eq("id", validation.data.repositoryId)
            .single();

        if (error || !repository) {
            return NextResponse.json(
                { error: "Repository not found" },
                { status: 404 }
            );
        }

        const { count } = await supabase
            .from("repository_files")
            .select("*", { count: "exact", head: true })
            .eq("repository_id", repository.id);

        return NextResponse.json({
            repositoryId: repository.id,
            status: repository.status,
            fileCount: repository.file_count || 0,
            chunksProcessed: count || 0,
            error: repository.error_message,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
