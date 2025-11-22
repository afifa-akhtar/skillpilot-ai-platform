-- Fix INSERT policy to include WITH CHECK clause
DROP POLICY IF EXISTS "Admins can insert tech stacks" ON public.tech_stacks;

CREATE POLICY "Admins can insert tech stacks" ON public.tech_stacks
  FOR INSERT WITH CHECK (public.is_admin());

