-- Fix RLS policy for tech_stacks with explicit INSERT, UPDATE, DELETE policies
-- This ensures all operations are properly covered

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage tech stacks" ON public.tech_stacks;

-- Ensure is_admin() function has proper security settings
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
END;
$$;

-- Create separate policies for INSERT, UPDATE, DELETE
CREATE POLICY "Admins can insert tech stacks" ON public.tech_stacks
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update tech stacks" ON public.tech_stacks
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete tech stacks" ON public.tech_stacks
  FOR DELETE USING (public.is_admin());

