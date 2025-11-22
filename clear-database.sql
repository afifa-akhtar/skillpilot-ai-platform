-- Script to clear all data from the database for testing
-- This preserves the schema but removes all data

-- Disable foreign key checks temporarily (PostgreSQL doesn't need this, but included for clarity)
-- Note: PostgreSQL uses TRUNCATE CASCADE to handle foreign keys

-- Clear data in reverse order of dependencies (child tables first)
-- Note: auth.users will need to be cleared separately if needed
TRUNCATE TABLE 
  public.admin_chat_messages,
  public.assessments,
  public.learning_items,
  public.learning_plans,
  public.learner_tech_stacks,
  public.learner_profiles,
  public.tech_stacks,
  public.users
CASCADE;

-- Reset sequences if any (PostgreSQL auto-increment sequences)
-- Note: This is usually handled automatically by TRUNCATE, but included for completeness

-- Verify tables are empty (optional - you can run this to check)
-- SELECT 'admin_chat_messages' as table_name, COUNT(*) as row_count FROM admin_chat_messages
-- UNION ALL
-- SELECT 'assessments', COUNT(*) FROM assessments
-- UNION ALL
-- SELECT 'quizzes', COUNT(*) FROM quizzes
-- UNION ALL
-- SELECT 'learning_items', COUNT(*) FROM learning_items
-- UNION ALL
-- SELECT 'learning_plans', COUNT(*) FROM learning_plans
-- UNION ALL
-- SELECT 'learner_tech_stacks', COUNT(*) FROM learner_tech_stacks
-- UNION ALL
-- SELECT 'learner_profiles', COUNT(*) FROM learner_profiles
-- UNION ALL
-- SELECT 'tech_stacks', COUNT(*) FROM tech_stacks
-- UNION ALL
-- SELECT 'users', COUNT(*) FROM users;

