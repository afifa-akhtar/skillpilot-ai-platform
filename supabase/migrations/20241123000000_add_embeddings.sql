-- Add embedding columns to learning_plans table
-- Embeddings will be stored as JSONB arrays for flexibility

ALTER TABLE public.learning_plans 
ADD COLUMN IF NOT EXISTS embedding JSONB,
ADD COLUMN IF NOT EXISTS embedding_metadata JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.learning_plans.embedding IS 'Vector embedding of the learning plan for semantic search and similarity matching';
COMMENT ON COLUMN public.learning_plans.embedding_metadata IS 'Metadata associated with the embedding (goals, duration, tech stacks, etc.)';

