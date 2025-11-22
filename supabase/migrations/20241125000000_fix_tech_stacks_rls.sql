-- Fix RLS policy for tech_stacks to use is_admin() function
-- This prevents recursion issues when checking admin role

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage tech stacks" ON public.tech_stacks;

-- Create new policy using is_admin() function
CREATE POLICY "Admins can manage tech stacks" ON public.tech_stacks
  FOR ALL USING (public.is_admin());

