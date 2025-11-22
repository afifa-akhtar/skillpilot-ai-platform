-- Fix is_admin() function to explicitly bypass RLS when querying users table
-- SECURITY DEFINER should bypass RLS, but we'll make it explicit

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- SECURITY DEFINER functions bypass RLS by default
  -- Query users table directly - RLS will be bypassed
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) INTO is_admin_user;
  
  RETURN COALESCE(is_admin_user, false);
END;
$$;

-- Ensure function owner has proper permissions
ALTER FUNCTION public.is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

