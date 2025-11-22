# Local Docker Setup - Quick Guide

## ✅ What's Already Done

1. ✅ Supabase CLI installed
2. ✅ Supabase initialized in project
3. ✅ Migration file created with database schema
4. ✅ Docker Compose file ready (optional)

## 🚀 Complete the Setup

### Step 1: Start Supabase (if not already running)

```bash
cd /Users/haiderhabib/Downloads/ai-hackathon-final
supabase start
```

**Note**: First time will download Docker images (~5-10 minutes). Subsequent starts are fast.

### Step 2: Get Your Local Credentials

```bash
supabase status
```

You'll see output like:
```
API URL: http://localhost:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 3: Apply Database Schema

The migration will run automatically when you start Supabase, but if you need to apply it manually:

```bash
supabase db reset
```

This will:
- Reset the database
- Apply all migrations (including our schema)
- Seed any seed data

### Step 4: Create .env.local File

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your local credentials from Step 2:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<copy from supabase status>
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Start the App

```bash
npm run dev
```

### Step 7: Access the App

- **App**: http://localhost:3000
- **Supabase Studio** (Database UI): http://localhost:54323

## 🎯 Quick Commands Reference

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# View status and credentials
supabase status

# Reset database (applies migrations)
supabase db reset

# View logs
supabase logs

# Access Supabase Studio
open http://localhost:54323
```

## 🔍 Verify Everything is Working

1. **Check Docker containers are running**:
   ```bash
   docker ps
   ```
   You should see several Supabase containers running.

2. **Check Supabase is up**:
   ```bash
   supabase status
   ```
   All services should show as "healthy".

3. **Test the app**:
   - Open http://localhost:3000
   - Try registering as a Learner or Admin
   - Check Supabase Studio to see if user was created

## 🐛 Troubleshooting

### Supabase won't start
- Make sure Docker Desktop is running
- Check if ports 54321-54323 are available
- Try: `supabase stop` then `supabase start`

### Database schema not applied
- Run: `supabase db reset`
- Or manually run the SQL in Supabase Studio

### Can't connect to database
- Verify `.env.local` has correct credentials
- Run `supabase status` to get fresh credentials
- Make sure Supabase is running: `supabase status`

### Port conflicts
- Stop other services using ports 54321-54323
- Or change ports in `supabase/config.toml`

## 📝 Next Steps

1. ✅ Start Supabase: `supabase start`
2. ✅ Get credentials: `supabase status`
3. ✅ Create `.env.local` with credentials
4. ✅ Install deps: `npm install`
5. ✅ Run app: `npm run dev`
6. 🎉 Start building!

---

**All set! Your local Supabase is running in Docker and ready to use! 🚀**

