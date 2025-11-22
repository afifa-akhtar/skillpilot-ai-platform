-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('learner', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tech Stacks table (managed by Admin)
CREATE TABLE IF NOT EXISTS public.tech_stacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learner Profiles table
CREATE TABLE IF NOT EXISTS public.learner_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_designation TEXT,
  total_experience INTEGER, -- in years
  strengths TEXT,
  improvement_areas TEXT,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learner Tech Stack Proficiency table
CREATE TABLE IF NOT EXISTS public.learner_tech_stacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.learner_profiles(id) ON DELETE CASCADE,
  tech_stack_id UUID NOT NULL REFERENCES public.tech_stacks(id) ON DELETE CASCADE,
  proficiency TEXT NOT NULL CHECK (proficiency IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
  years_of_experience INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, tech_stack_id)
);

-- Learning Plans table
CREATE TABLE IF NOT EXISTS public.learning_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goals TEXT NOT NULL,
  hours_per_week INTEGER NOT NULL,
  months INTEGER NOT NULL,
  is_project_related BOOLEAN DEFAULT FALSE,
  project_name TEXT,
  tech_stacks JSONB, -- Array of tech stack IDs
  generated_plan TEXT, -- AI-generated plan text
  adjusted_plan TEXT, -- User/admin adjusted plan
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'in_progress', 'completed')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  redeemable_points INTEGER DEFAULT 0,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Items table (modules within a learning plan)
CREATE TABLE IF NOT EXISTS public.learning_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_plan_id UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  objectives TEXT,
  estimated_time INTEGER, -- in hours
  prerequisites TEXT,
  order_index INTEGER NOT NULL,
  content TEXT, -- AI-generated learning content
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessments table (for learning items)
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_item_id UUID REFERENCES public.learning_items(id) ON DELETE CASCADE,
  learning_plan_id UUID REFERENCES public.learning_plans(id) ON DELETE CASCADE, -- For final quiz
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('learning_item', 'final_quiz')),
  questions JSONB NOT NULL, -- Array of question objects
  learner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answers JSONB, -- Learner's answers
  score INTEGER, -- Percentage score
  passed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Chat Messages (for learning plan discussions)
CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_plan_id UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_tech_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Function to check if user is admin (bypasses RLS to avoid infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admins can read all users
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (public.is_admin());

-- Tech stacks are readable by all authenticated users
CREATE POLICY "Tech stacks are readable by all" ON public.tech_stacks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can manage tech stacks
CREATE POLICY "Admins can manage tech stacks" ON public.tech_stacks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Learners can manage their own profile
CREATE POLICY "Learners can manage own profile" ON public.learner_profiles
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Learners can manage their own tech stacks
CREATE POLICY "Learners can manage own tech stacks" ON public.learner_tech_stacks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.learner_profiles
      WHERE learner_profiles.id = learner_tech_stacks.profile_id
      AND (learner_profiles.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM public.users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );

-- Learning plans policies
CREATE POLICY "Learners can manage own learning plans" ON public.learning_plans
  FOR ALL USING (
    learner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Learning items policies
CREATE POLICY "Users can access learning items" ON public.learning_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.id = learning_items.learning_plan_id
      AND (learning_plans.learner_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM public.users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );

-- Assessments policies
CREATE POLICY "Users can access assessments" ON public.assessments
  FOR ALL USING (
    learner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Chat messages policies
CREATE POLICY "Users can access chat messages" ON public.admin_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.learning_plans
      WHERE learning_plans.id = admin_chat_messages.learning_plan_id
      AND (learning_plans.learner_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM public.users
             WHERE users.id = auth.uid() AND users.role = 'admin'
           ))
    )
  );

-- Function to automatically create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'learner'); -- Default to learner, can be updated
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user record
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_stacks_updated_at BEFORE UPDATE ON public.tech_stacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learner_profiles_updated_at BEFORE UPDATE ON public.learner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learner_tech_stacks_updated_at BEFORE UPDATE ON public.learner_tech_stacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_plans_updated_at BEFORE UPDATE ON public.learning_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_items_updated_at BEFORE UPDATE ON public.learning_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

