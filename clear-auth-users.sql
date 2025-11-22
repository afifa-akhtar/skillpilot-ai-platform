-- Script to clear auth.users table (Supabase authentication)
-- WARNING: This will delete all user accounts including authentication data
-- Only run this if you want to completely reset authentication

-- Delete all auth users (this will cascade to public.users due to foreign key)
DELETE FROM auth.users;

-- Verify auth users are cleared
SELECT COUNT(*) as remaining_auth_users FROM auth.users;

