# Local Supabase Setup with Docker

For full local development with Supabase (including Auth), you can use Supabase CLI which runs everything in Docker.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+

## Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Initialize Supabase in your project:
```bash
supabase init
```

3. Start local Supabase (runs PostgreSQL, Auth, Storage, etc. in Docker):
```bash
supabase start
```

This will:
- Start all Supabase services in Docker containers
- Create a local PostgreSQL database
- Set up Auth, Storage, and other Supabase services
- Provide local connection strings

4. Get your local credentials:
```bash
supabase status
```

5. Update your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

6. Run the database schema:
```bash
# Connect to local database and run schema.sql
# Or use Supabase Studio at http://localhost:54323
supabase db reset  # This will reset and apply migrations
```

7. Access Supabase Studio (local dashboard):
- URL: http://localhost:54323
- Use the credentials from `supabase status`

## Useful Commands

```bash
# Stop Supabase
supabase stop

# Reset database
supabase db reset

# View logs
supabase logs

# Generate TypeScript types (if needed)
supabase gen types typescript --local > types/supabase.ts
```

## Alternative: Plain PostgreSQL Docker

If you only need PostgreSQL (without Supabase Auth), use the `docker-compose.yml` file:

```bash
docker-compose up -d
```

Then connect to PostgreSQL and run `supabase/schema.sql` manually.

