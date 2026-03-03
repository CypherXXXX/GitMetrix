import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";
import { IndexRepositorySchema, parseRepoUrl } from "@/lib/validators";

const STALE_INDEXING_MINUTES = 5;

function isStaleIndexing(updatedAt: string | null): boolean {
    if (!updatedAt) return true;
    const updated = new Date(updatedAt).getTime();
    const now = Date.now();
    return now - updated > STALE_INDEXING_MINUTES * 60 * 1000;
}

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

            const { error } = await supabase
                .from("repositories")
                .update({
                    status: "pending",
                    file_count: 0,
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
                    status: "pending",
                })
                .select()
                .single();

            if (error || !newRepo) {
                throw new Error(error?.message || "Failed to create repository");
            }
            repositoryId = newRepo.id;
        }

        await inngest.send({
            name: "repo/index.requested",
            data: { owner, name, repositoryId },
        });

        return NextResponse.json({
            repositoryId,
            status: "pending",
            message: "Indexing started",
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
