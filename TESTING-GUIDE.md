# 🧪 Testing Guide - SkillPilot AI

## 🚀 Application URLs

### Main Application
- **Homepage**: http://localhost:3000
- **Supabase Studio** (Database UI): http://127.0.0.1:54323

---

## 👤 Testing as a Learner (Software Engineer)

### Step 1: Register as Learner
1. Go to: **http://localhost:3000**
2. Click **"Register as Learner"** or go directly to: **http://localhost:3000/learner/register**
3. Fill in:
   - Email: `learner@test.com` (or any email)
   - Password: `password123` (min 6 characters)
   - Confirm Password: `password123`
4. Click **"Create Account"**
5. You'll be redirected to login page

### Step 2: Login as Learner
1. Go to: **http://localhost:3000/learner/login**
2. Enter:
   - Email: `learner@test.com`
   - Password: `password123`
3. Click **"Log In"**
4. You'll be redirected to the dashboard

### Step 3: Complete Profile (Mandatory First Step)
1. You'll see a prompt to complete your profile
2. Or go directly to: **http://localhost:3000/learner/profile**
3. Fill in:
   - **Role/Designation**: e.g., "Senior Software Engineer"
   - **Total Experience**: e.g., "5" (years)
   - **Strengths**: e.g., "Problem solving, System design, Team leadership"
   - **Improvement Areas**: e.g., "Cloud architecture, Microservices, DevOps"
   - **Tech Stacks**: 
     - First, an Admin needs to add tech stacks
     - Or you can skip for now and add later
4. Click **"Save Profile"**

### Step 4: Create Learning Plan
1. Go to: **http://localhost:3000/learner/create-plan**
2. Fill in:
   - **Learning Goals**: e.g., "Learn advanced React patterns and state management"
   - **Hours per Week**: e.g., "10"
   - **Duration (Months)**: e.g., "3"
   - **Project Related**: Check if applicable
   - **Tech Stacks**: Select from your profile tech stacks
3. Click **"Generate Learning Plan"** (AI will create a plan)
4. Review and adjust if needed
5. Click **"Submit for Approval"**

### Step 5: View Learning Content (After Approval)
1. Once approved by Admin, go to: **http://localhost:3000/learner/dashboard**
2. Click on your learning plan
3. Start learning items
4. Take assessments
5. Complete final quiz

---

## 👨‍💼 Testing as an Admin (Organizational Development)

### Step 1: Register as Admin
1. Go to: **http://localhost:3000**
2. Click **"Register as Admin"** or go directly to: **http://localhost:3000/admin/register**
3. Fill in:
   - Email: `admin@test.com` (or any email)
   - Password: `admin123` (min 6 characters)
   - Confirm Password: `admin123`
4. Click **"Create Account"**

### Step 2: Login as Admin
1. Go to: **http://localhost:3000/admin/login**
2. Enter:
   - Email: `admin@test.com`
   - Password: `admin123`
3. Click **"Log In"**
4. You'll see the Admin Dashboard

### Step 3: Add Tech Stacks
1. Click **"Manage Tech Stacks"** or go to: **http://localhost:3000/admin/tech-stacks**
2. Click **"Add Tech Stack"**
3. Add tech stacks like:
   - Name: "React"
   - Description: "JavaScript library for building user interfaces"
4. Add more: "Node.js", "Python", "MySQL", "MongoDB", etc.
5. These will be available for learners to select in their profiles

### Step 4: Approve Learning Plans
1. Go to: **http://localhost:3000/admin/dashboard**
2. Click on **"Pending Approvals"** tab
3. Click **"Review & Approve"** on a learning plan
4. Review the plan
5. You can:
   - Edit the plan text
   - Use "Improve with AI" to enhance it
   - Chat with the learner
   - Set redeemable points
   - **Approve** or **Reject** the plan

### Step 5: View All Learners
1. Go to **"Learners"** tab in Admin Dashboard
2. See all registered learners
3. View their progress

---

## 🧪 Quick Test Flow

### Complete Test Scenario:

1. **Admin Setup** (5 min):
   ```
   Register Admin → Login → Add Tech Stacks (React, Node.js, Python)
   ```

2. **Learner Journey** (10 min):
   ```
   Register Learner → Login → Complete Profile → 
   Create Learning Plan → Submit for Approval
   ```

3. **Admin Approval** (5 min):
   ```
   Login as Admin → Review Plan → Approve → Set Points
   ```

4. **Learner Learning** (10 min):
   ```
   Login as Learner → View Approved Plan → 
   Start Learning Items → Generate Content → 
   Take Assessments → Complete Final Quiz
   ```

---

## 🔍 Testing Checklist

### Authentication
- [ ] Can register as Learner
- [ ] Can register as Admin
- [ ] Can login as Learner
- [ ] Can login as Admin
- [ ] Cannot access wrong role's pages

### Learner Features
- [ ] Can complete profile
- [ ] Can add tech stacks to profile
- [ ] Can create learning plan
- [ ] AI generates learning plan
- [ ] Can submit plan for approval
- [ ] Can view learning content (after approval)
- [ ] Can take assessments
- [ ] Can see progress

### Admin Features
- [ ] Can add tech stacks
- [ ] Can view all learners
- [ ] Can view pending plans
- [ ] Can approve/reject plans
- [ ] Can edit plans
- [ ] Can chat with learners
- [ ] Can set redeemable points
- [ ] Can see dashboard stats

### AI Features
- [ ] Learning plan generation works
- [ ] Content generation works
- [ ] Assessment generation works
- [ ] Plan improvement works

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot connect to database"
**Solution**: Make sure Supabase is running:
```bash
supabase status
```

### Issue: "Authentication failed"
**Solution**: Check `.env.local` has correct Supabase keys

### Issue: "AI generation not working"
**Solution**: 
- Verify `OPENAI_API_KEY` in `.env.local`
- Check `OPENAI_BASE_URL` is correct
- Check browser console for errors

### Issue: "No tech stacks available"
**Solution**: Admin needs to add tech stacks first

---

## 📊 Database Verification

Check Supabase Studio: http://127.0.0.1:54323

You should see these tables:
- `users` - All registered users
- `tech_stacks` - Tech stacks added by admin
- `learner_profiles` - Learner profile data
- `learning_plans` - All learning plans
- `learning_items` - Learning modules
- `assessments` - Assessments and quizzes

---

## 🎯 Test Accounts (Quick Start)

### Admin Account
- **URL**: http://localhost:3000/admin/login
- **Email**: `admin@test.com`
- **Password**: `admin123`

### Learner Account
- **URL**: http://localhost:3000/learner/login
- **Email**: `learner@test.com`
- **Password**: `password123`

---

**Happy Testing! 🚀**

