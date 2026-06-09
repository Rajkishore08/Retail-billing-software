-- First, we need to create users through Supabase Auth API or Dashboard
-- This script creates the profile records for demo users

-- Note: You need to create these users in Supabase Auth Dashboard first:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" and create these accounts:
--    - Email: admin@nationalmart.com, Password: admin123
--    - Email: manager@nationalmart.com, Password: manager123  
--    - Email: cashier@nationalmart.com, Password: cashier123

-- After creating users in Auth, run this to create their profiles:

-- Function to create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'admin@nationalmart.com' THEN 'admin'::user_role
      WHEN NEW.email = 'manager@nationalmart.com' THEN 'manager'::user_role
      ELSE 'cashier'::user_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- If you already have users in auth.users, you can manually insert profiles:
-- (Replace the UUIDs with actual user IDs from your auth.users table)

-- To find user IDs, run: SELECT id, email FROM auth.users;

-- Example manual profile creation (update with real UUIDs):
-- INSERT INTO profiles (id, email, full_name, role) 
-- SELECT 
--   id,
--   email,
--   CASE 
--     WHEN email = 'admin@nationalmart.com' THEN 'Admin User'
--     WHEN email = 'manager@nationalmart.com' THEN 'Manager User'
--     WHEN email = 'cashier@nationalmart.com' THEN 'Cashier User'
--     ELSE split_part(email, '@', 1)
--   END as full_name,
--   CASE 
--     WHEN email = 'admin@nationalmart.com' THEN 'admin'::user_role
--     WHEN email = 'manager@nationalmart.com' THEN 'manager'::user_role
--     ELSE 'cashier'::user_role
--   END as role
-- FROM auth.users 
-- WHERE email IN ('admin@nationalmart.com', 'manager@nationalmart.com', 'cashier@nationalmart.com')
-- ON CONFLICT (id) DO NOTHING;
