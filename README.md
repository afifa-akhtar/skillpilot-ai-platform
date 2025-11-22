# SkillPilot AI - Learning & Growth Platform

An AI-powered learning platform designed for software engineering teams. Replace static Excel-based growth plans with personalized learning paths, AI-generated content, daily micro-missions, and progress dashboards.

## Features

### For Learners (Software Engineers)
- **Profile Management**: Complete your profile with role, experience, strengths, weaknesses, and tech stack proficiency
- **AI-Generated Learning Plans**: Create personalized learning plans based on your goals, time availability, and tech stacks
- **Interactive Learning Content**: AI-generated learning content for each module
- **Assessments**: Take assessments for each learning item to track progress
- **Progress Tracking**: Visual dashboards showing your learning progress
- **Final Quiz**: Complete a comprehensive quiz to finish your learning plan

### For Admins (Organizational Development)
- **Tech Stack Management**: Configure organizational tech stacks that learners can select
- **Learning Plan Approval**: Review, edit, and approve learning plans submitted by learners
- **AI-Powered Chat**: Discuss and improve learning plans with learners through integrated chat
- **Progress Visibility**: Dashboard showing all learners, their progress, and learning plan statuses
- **Point Allocation**: Allocate redeemable points to approved learning plans

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: JavaScript (no TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui + Radix UI
- **Database**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI GPT-4o
- **State Management**: React Context / Zustand
- **Icons**: Lucide React
- **Delights**: canvas-confetti, sonner

## Getting Started

> **🎯 Quick Start**: See [SETUP.md](./SETUP.md) for the fastest setup guide (recommended for hackathon)

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free) OR Docker for local setup
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-hackathon-final
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Set up database (choose one option):

   **Option A: Use Supabase Cloud (Recommended for Hackathon)**
   - Create a new Supabase project at https://supabase.com
   - Run the SQL schema from `supabase/schema.sql` in the Supabase SQL editor
   - Use the Supabase URL and keys in your `.env.local`

   **Option B: Run PostgreSQL with Docker (Local Development)**
   ```bash
   # Start PostgreSQL and pgAdmin
   docker-compose up -d
   
   # Wait for PostgreSQL to be ready, then run the schema
   # Connect to the database and run supabase/schema.sql
   # Or use pgAdmin at http://localhost:5050
   #   - Email: admin@skillpilot.local
   #   - Password: admin
   #   - Add server: host=postgres, user=postgres, password=postgres, database=skillpilot
   ```
   
   **Note**: For local Docker setup, you'll still need Supabase for authentication.
   Consider using Supabase CLI for full local development:
   ```bash
   npm install -g supabase
   supabase init
   supabase start
   ```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── (learner)/
│   │   ├── dashboard/          # Learner dashboard
│   │   ├── profile/            # Profile completion page
│   │   ├── create-plan/        # Learning plan creation
│   │   ├── learn/[id]/        # Learning plan view
│   │   └── learn/[id]/item/   # Individual learning items
│   ├── (admin)/
│   │   ├── dashboard/          # Admin dashboard
│   │   ├── tech-stacks/        # Tech stack management
│   │   └── approve-plan/       # Learning plan approval
│   ├── api/
│   │   ├── generate-learning-plan/  # AI learning plan generation
│   │   ├── generate-content/       # AI content generation
│   │   ├── generate-assessment/    # AI assessment generation
│   │   └── improve-plan/          # AI plan improvement
│   ├── learner/                # Learner auth pages
│   ├── admin/                  # Admin auth pages
│   └── page.js                 # Homepage
├── components/
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── supabaseClient.js       # Supabase client
│   ├── supabaseServer.js       # Server-side Supabase
│   ├── prompts.js              # AI prompts
│   └── utils.js                # Utility functions
└── supabase/
    └── schema.sql              # Database schema
```

## Usage

### For Learners

1. **Register/Login**: Create an account at `/learner/register` or login at `/learner/login`
2. **Complete Profile**: Fill in your profile information (mandatory first step)
3. **Create Learning Plan**: 
   - Go to "Create Learning Plan"
   - Enter your learning goals, time commitment, and select tech stacks
   - Generate AI-powered learning plan
   - Adjust if needed and submit for approval
4. **Learn**: Once approved, access learning content and complete assessments
5. **Final Quiz**: Complete the final quiz to finish your learning plan

### For Admins

1. **Register/Login**: Create an account at `/admin/register` or login at `/admin/login`
2. **Manage Tech Stacks**: Add organizational tech stacks that learners can use
3. **Review Plans**: View and approve/reject learning plans submitted by learners
4. **Chat with Learners**: Use the chat feature to discuss plan improvements
5. **Track Progress**: Monitor all learners' progress from the dashboard

## Database Schema

The application uses the following main tables:
- `users` - User accounts with roles
- `tech_stacks` - Organizational tech stacks
- `learner_profiles` - Learner profile information
- `learner_tech_stacks` - Tech stack proficiency for learners
- `learning_plans` - Learning plans created by learners
- `learning_items` - Individual modules/items within a plan
- `assessments` - Assessments and quizzes
- `admin_chat_messages` - Chat messages between admins and learners

See `supabase/schema.sql` for the complete schema.

## API Routes

- `POST /api/generate-learning-plan` - Generate AI learning plan
- `POST /api/generate-content` - Generate learning content for an item
- `POST /api/generate-assessment` - Generate assessment/quiz
- `POST /api/improve-plan` - Improve learning plan with AI

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Docker Commands

```bash
# Start PostgreSQL and pgAdmin
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f postgres

# Remove volumes (clean slate)
docker-compose down -v
```

**Database Connection (Docker)**:
- Host: `localhost`
- Port: `5432`
- Database: `skillpilot`
- User: `postgres`
- Password: `postgres`

**pgAdmin Access (Docker)**:
- URL: http://localhost:5050
- Email: `admin@skillpilot.local`
- Password: `admin`

## Notes

- All files use `.js` extension (no TypeScript)
- Mobile-first responsive design
- Uses indigo-600 and teal-500 as primary colors
- Confetti animations on completions
- Toast notifications for user feedback

## License

This project is built for a hackathon.

# skillpilot-ai
