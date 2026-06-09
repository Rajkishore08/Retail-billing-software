-- Fix Supabase Auth Security Warnings
-- This script addresses auth_otp_long_expiry and auth_leaked_password_protection warnings

-- Note: These settings need to be configured in the Supabase Dashboard
-- Go to Authentication > Settings to apply these changes

-- 1. Fix OTP Expiry (set to 1 hour instead of longer)
-- In Supabase Dashboard:
-- 1. Go to Authentication > Settings
-- 2. Find "Email Auth" section
-- 3. Set "OTP Expiry" to 3600 seconds (1 hour)
-- 4. Save changes

-- 2. Enable Leaked Password Protection
-- In Supabase Dashboard:
-- 1. Go to Authentication > Settings
-- 2. Find "Password Security" section
-- 3. Enable "Leaked Password Protection"
-- 4. Save changes

-- Alternative: Use Supabase CLI to update settings
-- supabase auth config --otp-expiry 3600
-- supabase auth config --enable-leaked-password-protection

-- Create a function to validate password strength
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check minimum length (8 characters)
  IF LENGTH(password) < 8 THEN
    RETURN false;
  END IF;
  
  -- Check for at least one uppercase letter
  IF password !~ '[A-Z]' THEN
    RETURN false;
  END IF;
  
  -- Check for at least one lowercase letter
  IF password !~ '[a-z]' THEN
    RETURN false;
  END IF;
  
  -- Check for at least one digit
  IF password !~ '[0-9]' THEN
    RETURN false;
  END IF;
  
  -- Check for at least one special character
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Create a function to check for common weak passwords
CREATE OR REPLACE FUNCTION public.check_weak_password(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- List of common weak passwords
  IF password IN (
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'football', 'superman', 'trustno1'
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create a comprehensive password validation function
CREATE OR REPLACE FUNCTION public.validate_user_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if password is too weak
  IF public.check_weak_password(password) THEN
    RETURN 'Password is too common. Please choose a stronger password.';
  END IF;
  
  -- Check password strength
  IF NOT public.validate_password_strength(password) THEN
    RETURN 'Password must be at least 8 characters long and contain uppercase, lowercase, digit, and special character.';
  END IF;
  
  RETURN 'OK';
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.validate_password_strength(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_weak_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_user_password(text) TO authenticated;

-- Create a trigger to validate passwords on user creation/update
-- Note: This is a client-side validation example
-- In production, use Supabase's built-in password validation

-- Create a function to log authentication attempts
CREATE OR REPLACE FUNCTION public.log_auth_attempt(
  user_id uuid,
  success boolean,
  ip_address inet DEFAULT NULL,
  user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auth_logs (
    user_id,
    success,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    log_auth_attempt.user_id,
    log_auth_attempt.success,
    log_auth_attempt.ip_address,
    log_auth_attempt.user_agent,
    CURRENT_TIMESTAMP
  );
END;
$$;

-- Create auth_logs table for security monitoring
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON public.auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON public.auth_logs(created_at);

-- Enable RLS on auth_logs
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for auth_logs
CREATE POLICY "Users can view their own auth logs" ON public.auth_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_auth_attempt(uuid, boolean, inet, text) TO authenticated;
GRANT SELECT ON public.auth_logs TO authenticated;

-- Create a function to get failed login attempts
CREATE OR REPLACE FUNCTION public.get_failed_login_attempts(
  user_id uuid,
  hours_back integer DEFAULT 24
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count integer;
BEGIN
  SELECT COUNT(*)
  INTO failed_count
  FROM public.auth_logs
  WHERE user_id = get_failed_login_attempts.user_id
    AND success = false
    AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour' * hours_back;
  
  RETURN failed_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_failed_login_attempts(uuid, integer) TO authenticated; 