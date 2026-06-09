-- This script ensures that every user in auth.users has a corresponding profile in public.profiles
-- It also attempts to clean up any potential duplicate profiles (though unlikely with PK)

-- 1. Delete any profiles that do not have a corresponding user in auth.users
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. Insert missing profiles for users in auth.users that don't have a profile
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) AS full_name,
    CASE
        WHEN au.email = 'admin@nationalmart.com' THEN 'admin'::user_role
        WHEN au.email = 'manager@nationalmart.com' THEN 'manager'::user_role
        ELSE 'cashier'::user_role
    END AS role
FROM
    auth.users AS au
LEFT JOIN
    public.profiles AS p ON au.id = p.id
WHERE
    p.id IS NULL
ON CONFLICT (id) DO NOTHING; -- Should not conflict if p.id IS NULL, but good practice

-- 3. Update roles and names for existing profiles based on email (for demo users)
UPDATE public.profiles AS p
SET
    full_name = CASE
        WHEN au.email = 'admin@nationalmart.com' THEN 'Admin User'
        WHEN au.email = 'manager@nationalmart.com' THEN 'Manager User'
        WHEN au.email = 'cashier@nationalmart.com' THEN 'Cashier User'
        ELSE p.full_name -- Keep existing if not a demo user
    END,
    role = CASE
        WHEN au.email = 'admin@nationalmart.com' THEN 'admin'::user_role
        WHEN au.email = 'manager@nationalmart.com' THEN 'manager'::user_role
        WHEN au.email = 'cashier@nationalmart.com' THEN 'cashier'::user_role
        ELSE p.role -- Keep existing if not a demo user
    END
FROM auth.users AS au
WHERE p.id = au.id
AND au.email IN ('admin@nationalmart.com', 'manager@nationalmart.com', 'cashier@nationalmart.com');

-- Wrap the final RAISE NOTICE in a DO block
DO $$
BEGIN
    RAISE NOTICE 'User profiles synchronized successfully!';
END $$;
