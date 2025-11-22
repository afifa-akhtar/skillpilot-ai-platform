-- This file is automatically executed when the PostgreSQL container starts
-- It sets up the database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: For local development with Docker, you'll need to set up Supabase Auth separately
-- or use a local Supabase instance. This file contains just the database schema.
-- For full Supabase functionality, consider using Supabase CLI for local development.

-- See schema.sql for the complete database schema
-- You can run schema.sql manually after the container is up, or copy its contents here

