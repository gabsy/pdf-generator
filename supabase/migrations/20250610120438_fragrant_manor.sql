/*
  # Setup User Profiles System

  1. Triggers
    - Create trigger to automatically create user profile when auth user is created
    - Update trigger function to handle new user creation

  2. Admin User Setup
    - Insert gabi.schiopu as admin user if exists in auth.users
    - Handle case where user might not exist yet

  3. Functions
    - Update handle_new_user function to properly create profiles
*/

-- Create or replace the trigger function for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, role, created_by)
  VALUES (
    NEW.id,
    NEW.email,
    'user'::user_role,
    NULL
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert gabi.schiopu as admin if the auth user exists
DO $$
DECLARE
  gabi_user_id uuid;
BEGIN
  -- Try to find gabi.schiopu in auth.users
  SELECT id INTO gabi_user_id
  FROM auth.users
  WHERE email = 'gabi.schiopu@example.com' OR email ILIKE '%gabi.schiopu%'
  LIMIT 1;

  -- If found, create or update the profile as admin
  IF gabi_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, email, role, created_by)
    SELECT 
      gabi_user_id,
      email,
      'admin'::user_role,
      NULL
    FROM auth.users
    WHERE id = gabi_user_id
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin'::user_role;
      
    RAISE NOTICE 'Created/updated admin profile for user ID: %', gabi_user_id;
  ELSE
    RAISE NOTICE 'No user found with email containing gabi.schiopu';
  END IF;
END $$;

-- Also create profiles for any existing auth users that don't have profiles
INSERT INTO user_profiles (id, email, role, created_by)
SELECT 
  au.id,
  au.email,
  CASE 
    WHEN au.email ILIKE '%gabi.schiopu%' THEN 'admin'::user_role
    ELSE 'user'::user_role
  END,
  NULL
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
  AND au.email IS NOT NULL;