import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { IndexRepositorySchema, parseRepoUrl } from "@/lib/validators";
import { indexRepository } from "@/lib/indexer";

const STALE_INDEXING_MINUTES = 10;

function isStaleIndexing(updatedAt: string | null): boolean {
    if (!updatedAt) return true;
    const updated = new Date(updatedAt).getTime();
    const now = Date.now();
    return now - updated > STALE_INDEXING_MINUTES * 60 * 1000;
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = IndexRepositorySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const { owner, name } = parseRepoUrl(validation.data.repoUrl);
        const fullName = `${owner}/${name}`;

        const { data: existingRepo } = await supabase
            .from("repositories")
            .select("*")
            .eq("full_name", fullName)
            .single();

        if (existingRepo && existingRepo.status === "completed") {
            return NextResponse.json({
                repositoryId: existingRepo.id,
                status: existingRepo.status,
                message: "Repository already indexed",
            });
        }

        if (existingRepo && existingRepo.status === "indexing" && !isStaleIndexing(existingRepo.updated_at)) {
            return NextResponse.json({
                repositoryId: existingRepo.id,
                status: existingRepo.status,
                message: "Repository is currently being indexed",
            });
        }

        let repositoryId: string;

        if (existingRepo) {
            await supabase
                .from("repository_files")
                .delete()
                .eq("repository_id", existingRepo.id);

            await supabase
                .from("dependency_edges")
                .delete()
                .eq("repository_id", existingRepo.id);

            const { error } = await supabase
                .from("repositories")
                .update({
                    status: "indexing",
                    file_count: 0,
                    total_files_discovered: 0,
                    total_files_processed: 0,
                    total_chunks: 0,
                    total_vectors: 0,
                    languages_json: null,
                    error_message: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingRepo.id);

            if (error) throw new Error(error.message);
            repositoryId = existingRepo.id;
        } else {
            const { data: newRepo, error } = await supabase
                .from("repositories")
                .insert({
                    owner,
                    name,
                    full_name: fullName,
                    status: "indexing",
                })
                .select()
                .single();

            if (error || !newRepo) {
                throw new Error(error?.message || "Failed to create repository");
            }
            repositoryId = newRepo.id;
        }

        indexRepository(owner, name, repositoryId).catch(async (err) => {
            await supabase
                .from("repositories")
                .update({
                    status: "failed",
                    error_message: err instanceof Error ? err.message : "Indexing failed",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", repositoryId);
        });

        return NextResponse.json({
            repositoryId,
            status: "indexing",
            message: "Indexing started",
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
