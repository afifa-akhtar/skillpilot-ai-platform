-- Fix RLS policy to allow admins to see all users
-- This migration adds a policy to allow admins to read all users
-- Using auth.users to avoid infinite recursion

-- Drop the policy if it already exists (idempotent)
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;

-- Create a function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policy to allow admins to read all users
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (public.is_admin());

