ALTER TABLE repository_files
    ADD COLUMN IF NOT EXISTS symbol_name TEXT,
    ADD COLUMN IF NOT EXISTS symbol_type TEXT,
    ADD COLUMN IF NOT EXISTS language TEXT,
    ADD COLUMN IF NOT EXISTS start_line INTEGER,
    ADD COLUMN IF NOT EXISTS end_line INTEGER,
    ADD COLUMN IF NOT EXISTS metadata_json JSONB;

ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS total_files_discovered INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_files_processed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_vectors INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS languages_json JSONB;

CREATE TABLE IF NOT EXISTS dependency_edges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    edge_type TEXT NOT NULL DEFAULT 'import',
    specifiers TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dependency_edges_repo_id ON dependency_edges(repository_id);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_source ON dependency_edges(source_path);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_target ON dependency_edges(target_path);

CREATE INDEX IF NOT EXISTS idx_repository_files_symbol ON repository_files(symbol_name) WHERE symbol_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repository_files_language ON repository_files(language) WHERE language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repository_files_file_path ON repository_files(file_path);

DELETE FROM repository_files a
USING repository_files b
WHERE a.ctid < b.ctid
  AND a.repository_id = b.repository_id
  AND a.file_path = b.file_path
  AND a.chunk_index = b.chunk_index;

CREATE UNIQUE INDEX IF NOT EXISTS idx_repository_files_unique_chunk
    ON repository_files(repository_id, file_path, chunk_index);

DROP FUNCTION IF EXISTS match_file_chunks(vector, uuid, double precision, integer);

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
    similarity FLOAT,
    symbol_name TEXT,
    symbol_type TEXT,
    language TEXT,
    start_line INTEGER,
    end_line INTEGER
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
        1 - (rf.embedding <=> query_embedding) AS similarity,
        rf.symbol_name,
        rf.symbol_type,
        rf.language,
        rf.start_line,
        rf.end_line
    FROM repository_files rf
    WHERE rf.repository_id = target_repository_id
        AND 1 - (rf.embedding <=> query_embedding) > match_threshold
    ORDER BY rf.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
