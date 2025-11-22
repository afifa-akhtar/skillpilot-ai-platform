# Quick Setup Guide - SkillPilot AI

## 🚀 Recommended: Supabase Cloud (Fastest for Hackathon)

**Time: ~5 minutes | Best for: Hackathon, Demo, Quick Start**

### Steps:

1. **Create Supabase Account** (if you don't have one):
   - Go to https://supabase.com
   - Sign up (free tier is perfect for hackathon)

2. **Create New Project**:
   - Click "New Project"
   - Name: `skillpilot-ai`
   - Database Password: (save this!)
   - Region: Choose closest to you
   - Wait ~2 minutes for setup

3. **Get Your Credentials**:
   - Go to Project Settings → API
   - Copy:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

4. **Set Up Database Schema**:
   - Go to SQL Editor in Supabase dashboard
   - Click "New Query"
   - Copy entire contents of `supabase/schema.sql`
   - Paste and click "Run"
   - ✅ Schema created!

5. **Configure Environment**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   OPENAI_API_KEY=sk-...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

6. **Install & Run**:
   ```bash
   npm install
   npm run dev
   ```

7. **Done!** 🎉
   - Open http://localhost:3000
   - Register as Learner or Admin
   - Start building!

---

## 🐳 Alternative: Local Supabase with Docker (Full Control)

**Time: ~10 minutes | Best for: Offline Development, Full Local Control**

### Prerequisites:
- Docker Desktop installed and running
- Node.js 18+

### Steps:

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Initialize Supabase**:
   ```bash
   supabase init
   ```

3. **Start Local Supabase** (runs in Docker):
   ```bash
   supabase start
   ```
   
   This will:
   - Download and start PostgreSQL, Auth, Storage, etc. in Docker
   - Take 2-3 minutes first time
   - Show you local connection strings

4. **Get Local Credentials**:
   ```bash
   supabase status
   ```
   
   Copy the output - you'll see:
   - API URL
   - anon key
   - service_role key

5. **Set Up Database Schema**:
   ```bash
   # Option 1: Use Supabase Studio (Web UI)
   # Open http://localhost:54323 (from supabase status)
   # Go to SQL Editor, paste schema.sql, run it
   
   # Option 2: Use psql
   psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/schema.sql
   ```

6. **Configure Environment**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` with local credentials from step 4:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
   SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
   OPENAI_API_KEY=sk-...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

7. **Install & Run**:
   ```bash
   npm install
   npm run dev
   ```

8. **Access Supabase Studio**:
   - URL: http://localhost:54323
   - Manage database, view tables, run queries

### Useful Commands:
```bash
# Stop Supabase
supabase stop

# Restart
supabase restart

# View logs
supabase logs

# Reset database (clean slate)
supabase db reset
```

---

## 📊 Comparison

| Feature | Supabase Cloud | Local Supabase |
|---------|---------------|----------------|
| Setup Time | 5 min | 10 min |
| Internet Required | Yes | No (after setup) |
| Free Tier | ✅ Generous | ✅ Unlimited |
| Auth Included | ✅ | ✅ |
| Storage Included | ✅ | ✅ |
| Best For | Hackathon | Offline Dev |
| Complexity | ⭐ Easy | ⭐⭐ Medium |

---

## 🎯 My Recommendation for Hackathon

**Use Supabase Cloud** - It's faster, easier, and perfect for hackathons:
- ✅ No Docker setup needed
- ✅ Works immediately
- ✅ Free tier is generous
- ✅ Easy to demo
- ✅ Can access from anywhere
- ✅ No local resource usage

**Use Local Supabase** only if:
- You need offline development
- You want full control
- You're doing heavy database testing

---

## 🆘 Troubleshooting

### Supabase Cloud Issues:
- **Can't connect?** Check your `.env.local` has correct URL and keys
- **Schema errors?** Make sure you ran the entire `schema.sql` file
- **Auth not working?** Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set

### Local Supabase Issues:
- **Docker not running?** Start Docker Desktop first
- **Port conflicts?** Stop other services using ports 54321-54323
- **Reset everything:** `supabase stop && supabase start`

### General Issues:
- **Module not found?** Run `npm install` again
- **Build errors?** Check Node.js version (need 18+)
- **Database connection?** Verify credentials in `.env.local`

---

## ✅ Quick Checklist

- [ ] Supabase project created (Cloud) OR Supabase CLI installed (Local)
- [ ] Database schema run successfully
- [ ] `.env.local` file created with all keys
- [ ] `npm install` completed
- [ ] `npm run dev` runs without errors
- [ ] Can access http://localhost:3000
- [ ] Can register as Learner/Admin

---

**Ready to build! 🚀**

