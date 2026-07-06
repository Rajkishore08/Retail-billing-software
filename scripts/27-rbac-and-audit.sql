-- ============================================================
-- Migration 27: Dynamic RBAC System
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Extend profiles table ─────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- ── 2. Create roles_permissions table ────────────────────────
CREATE TABLE IF NOT EXISTS roles_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  role_name TEXT NOT NULL CHECK (role_name IN ('admin', 'manager', 'cashier')),
  module_name TEXT NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_name, module_name)
);

-- ── 3. Create user_status table ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_status (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 4. Create permission_audit_logs table ─────────────────────
CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_user_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL, -- 'PERMISSION_CHANGED', 'USER_CREATED', 'ROLE_CHANGED', 'ACCOUNT_STATUS_CHANGED'
  affected_user_id UUID REFERENCES profiles(id),
  affected_role TEXT,
  module_name TEXT,
  previous_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 5. Seed default permissions ───────────────────────────────
-- Admin: full access to everything (immutable)
INSERT INTO roles_permissions (role_name, module_name, can_view, can_create, can_update, can_delete) VALUES
  ('admin', 'dashboard',       TRUE, TRUE, TRUE, TRUE),
  ('admin', 'pos',             TRUE, TRUE, TRUE, TRUE),
  ('admin', 'products',        TRUE, TRUE, TRUE, TRUE),
  ('admin', 'inventory',       TRUE, TRUE, TRUE, TRUE),
  ('admin', 'customers',       TRUE, TRUE, TRUE, TRUE),
  ('admin', 'sales',           TRUE, TRUE, TRUE, TRUE),
  ('admin', 'reports',         TRUE, TRUE, TRUE, TRUE),
  ('admin', 'settings',        TRUE, TRUE, TRUE, TRUE),
  ('admin', 'users',           TRUE, TRUE, TRUE, TRUE),
  ('admin', 'product_history', TRUE, TRUE, TRUE, TRUE),

-- Manager: default permissions
  ('manager', 'dashboard',       TRUE,  FALSE, FALSE, FALSE),
  ('manager', 'pos',             TRUE,  TRUE,  TRUE,  FALSE),
  ('manager', 'products',        TRUE,  TRUE,  TRUE,  FALSE),
  ('manager', 'inventory',       TRUE,  TRUE,  TRUE,  FALSE),
  ('manager', 'customers',       TRUE,  TRUE,  TRUE,  FALSE),
  ('manager', 'sales',           TRUE,  FALSE, FALSE, FALSE),
  ('manager', 'reports',         TRUE,  FALSE, FALSE, FALSE),
  ('manager', 'settings',        FALSE, FALSE, FALSE, FALSE),
  ('manager', 'users',           FALSE, FALSE, FALSE, FALSE),
  ('manager', 'product_history', TRUE,  FALSE, FALSE, FALSE),

-- Cashier: default permissions
  ('cashier', 'dashboard',       TRUE,  FALSE, FALSE, FALSE),
  ('cashier', 'pos',             TRUE,  TRUE,  TRUE,  FALSE),
  ('cashier', 'products',        TRUE,  FALSE, FALSE, FALSE),
  ('cashier', 'inventory',       TRUE,  FALSE, FALSE, FALSE),
  ('cashier', 'customers',       TRUE,  TRUE,  FALSE, FALSE),
  ('cashier', 'sales',           TRUE,  FALSE, FALSE, FALSE),
  ('cashier', 'reports',         FALSE, FALSE, FALSE, FALSE),
  ('cashier', 'settings',        FALSE, FALSE, FALSE, FALSE),
  ('cashier', 'users',           FALSE, FALSE, FALSE, FALSE),
  ('cashier', 'product_history', FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role_name, module_name) DO NOTHING;

-- ── 6. Backfill user_status for existing profiles ─────────────
INSERT INTO user_status (user_id, is_active)
  SELECT id, TRUE FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- ── 7. Enable RLS ─────────────────────────────────────────────
ALTER TABLE roles_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS Policies ───────────────────────────────────────────

-- roles_permissions: all authenticated users can read (for nav filtering)
DROP POLICY IF EXISTS "Authenticated read roles_permissions" ON roles_permissions;
CREATE POLICY "Authenticated read roles_permissions"
  ON roles_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- roles_permissions: only admin can write
DROP POLICY IF EXISTS "Admin write roles_permissions" ON roles_permissions;
CREATE POLICY "Admin write roles_permissions"
  ON roles_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- user_status: authenticated users can read their own, admin reads all
DROP POLICY IF EXISTS "User read own status" ON user_status;
CREATE POLICY "User read own status"
  ON user_status FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin manage user_status" ON user_status;
CREATE POLICY "Admin manage user_status"
  ON user_status FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- permission_audit_logs: admin can read all; no one can modify/delete
DROP POLICY IF EXISTS "Admin read audit logs" ON permission_audit_logs;
CREATE POLICY "Admin read audit logs"
  ON permission_audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Authenticated insert audit logs" ON permission_audit_logs;
CREATE POLICY "Authenticated insert audit logs"
  ON permission_audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── 9. Updated_at trigger for roles_permissions ───────────────
CREATE TRIGGER update_roles_permissions_updated_at
  BEFORE UPDATE ON roles_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 10. profiles: update RLS to allow admin full access ───────
-- Security Definer function to check if a user is an admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Allow admin to read all profiles
DROP POLICY IF EXISTS "Admin can read all profiles" ON profiles;
CREATE POLICY "Admin can read all profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Allow admin to update any profile (for role changes)
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
CREATE POLICY "Admin can update profiles"
  ON profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Allow admin to insert profiles (for user creation)
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;
CREATE POLICY "Admin can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- ── 11. Function to update last_login_at ─────────────────────
CREATE OR REPLACE FUNCTION update_last_login(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET last_login_at = NOW() WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
