#!/bin/bash

# SkillPilot AI - Local Setup Script
# This script sets up Supabase locally with Docker

set -e

echo "🚀 Setting up SkillPilot AI locally with Docker..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    else
        echo "Please install Supabase CLI manually: https://github.com/supabase/cli#install-the-cli"
        exit 1
    fi
fi

echo "✅ Supabase CLI found"
echo ""

# Initialize Supabase if not already done
if [ ! -d "supabase" ]; then
    echo "📦 Initializing Supabase..."
    supabase init
    echo "✅ Supabase initialized"
else
    echo "✅ Supabase already initialized"
fi

echo ""
echo "🐳 Starting Supabase (this will download Docker images on first run)..."
echo "   This may take a few minutes..."
echo ""

# Start Supabase
supabase start

echo ""
echo "📋 Getting connection details..."
echo ""

# Get status and extract credentials
supabase status

echo ""
echo "📝 Next steps:"
echo "1. Copy the API URL, anon key, and service_role key from above"
echo "2. Create .env.local file with these credentials"
echo "3. Run the database schema: supabase db reset (or manually run supabase/schema.sql)"
echo "4. Install dependencies: npm install"
echo "5. Start the app: npm run dev"
echo ""
echo "💡 Tip: Access Supabase Studio at http://localhost:54323"
echo ""

