CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE repositories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'completed', 'failed')),
    file_count INTEGER DEFAULT 0,
    error_message TEXT,
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE repository_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    embedding vector(384),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_repository_files_repo_id ON repository_files(repository_id);
CREATE INDEX idx_repository_files_embedding ON repository_files USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_repositories_full_name ON repositories(full_name);

CREATE OR REPLACE FUNCTION match_file_chunks(
    query_embedding vector(384),
    target_repository_id UUID,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 8
)
RETURNS TABLE (
    id UUID,
    file_path TEXT,
    content TEXT,
    chunk_index INTEGER,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rf.id,
        rf.file_path,
        rf.content,
        rf.chunk_index,
        1 - (rf.embedding <=> query_embedding) AS similarity
    FROM repository_files rf
    WHERE rf.repository_id = target_repository_id
        AND 1 - (rf.embedding <=> query_embedding) > match_threshold
    ORDER BY rf.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
