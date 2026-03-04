CREATE INDEX IF NOT EXISTS idx_repository_files_fts
    ON repository_files
    USING GIN (to_tsvector('english', content));
