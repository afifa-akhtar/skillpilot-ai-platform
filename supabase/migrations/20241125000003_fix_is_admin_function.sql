-- Fix is_admin() function to properly bypass RLS
-- This ensures it can check admin role even when RLS is enabled

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS
  -- Query users table directly without RLS restrictions
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) INTO is_admin_user;
  
  RETURN COALESCE(is_admin_user, false);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

