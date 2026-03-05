ALTER TABLE repositories
    ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS last_commit_sha TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS code_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    function_count INTEGER DEFAULT 0,
    avg_function_length FLOAT DEFAULT 0,
    max_function_length INTEGER DEFAULT 0,
    max_cyclomatic_complexity INTEGER DEFAULT 0,
    max_nesting_depth INTEGER DEFAULT 0,
    line_count INTEGER DEFAULT 0,
    import_count INTEGER DEFAULT 0,
    export_count INTEGER DEFAULT 0,
    is_giant_file BOOLEAN DEFAULT FALSE,
    has_circular_deps BOOLEAN DEFAULT FALSE,
    risk_score FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pr_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_owner TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    pr_url TEXT NOT NULL,
    review_json JSONB NOT NULL DEFAULT '{}',
    overall_score FLOAT DEFAULT 0,
    bugs_count INTEGER DEFAULT 0,
    security_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_hashes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    sha TEXT NOT NULL,
    last_indexed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_metrics_repo_id ON code_metrics(repository_id);
CREATE INDEX IF NOT EXISTS idx_code_metrics_file_path ON code_metrics(file_path);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_repo ON pr_reviews(repository_owner, repository_name);
CREATE INDEX IF NOT EXISTS idx_file_hashes_repo_id ON file_hashes(repository_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_hashes_unique ON file_hashes(repository_id, file_path);
