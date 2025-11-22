#!/bin/bash

# Get Supabase keys for .env.local

echo "🔑 Getting Supabase keys..."
echo ""

# Get anon key from Kong
ANON_KEY=$(docker exec supabase_kong_ai-hackathon-final sh -c 'echo $KONG_ANON_KEY' 2>/dev/null)

# Get service_role key from Kong  
SERVICE_KEY=$(docker exec supabase_kong_ai-hackathon-final sh -c 'echo $KONG_SERVICE_ROLE_KEY' 2>/dev/null)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
    echo "⚠️  Could not extract keys from containers."
    echo ""
    echo "For local Supabase, you can use these default keys:"
    echo ""
    echo "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    echo "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    echo ""
    echo "These are the default local development keys."
else
    echo "✅ Found keys:"
    echo ""
    echo "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY"
fi

