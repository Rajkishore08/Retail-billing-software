# National Mini Mart POS System

A high-performance Point of Sale (POS) system for National Mini Mart, optimized for a small team with real-time sync, customer loyalty points, GST/rounding management, discount systems, and dashboard analytics.

---

## 🛠️ Database Setup & Recovery

If your Supabase database has been deleted due to inactivity, follow these steps to set up a brand new, fully configured database instance:

### Step 1: Create a New Supabase Project
1. Log in to [Supabase Dashboard](https://supabase.com).
2. Click **New Project** and select your organization.
3. Choose a project name, database password, and region, then click **Create new project**.
4. Wait for the database services to provision.

### Step 2: Configure Environment Variables
1. Once provisioned, navigate to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** and the **`anon` (public)** API Key.
3. In your local workspace, open the `.env.local` file and update the values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_new_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_new_supabase_anon_key
   ```

### Step 3: Run Database Setup Script
1. Open the [setup-complete-database.sql](scripts/setup-complete-database.sql) file.
2. Copy the entire contents of the file.
3. Go back to your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
4. Click **New Query**, paste the copied SQL, and click **Run**.
5. You should see a success message: `Database setup completed successfully! All tables, RPCs, views, RLS and seed data are configured.`

### Step 4: Create Cashier Accounts
1. In the Supabase Dashboard, navigate to **Authentication** (user icon) → **Users**.
2. Click **Add user** → **Create user** and add accounts for your team. You can use these defaults to match the system's demo setup:
   - **Admin**: `admin@nationalmart.com` (Role: admin)
   - **Manager**: `manager@nationalmart.com` (Role: manager)
   - **Cashier**: `cashier@nationalmart.com` (Role: cashier)
3. *Note: An automated database trigger (`on_auth_user_created`) will automatically synchronize these users into the public `profiles` table with their roles when they sign up or when their accounts are created.*

---

## 🧪 Verification & Testing

Verify that your new database is correctly connected and functions as expected:

1. **Verify Database Columns & Connection:**
   ```bash
   node test-database-connection.js
   ```
   *This checks if tables are queryable and ensures that all new columns (such as MRP, cost price, total savings, and discounts) are in place.*

2. **Verify Database Functions & Materialized Views:**
   ```bash
   node test-database-functions.js
   ```
   *This verifies that all required remote procedure calls (RPCs) like `get_products_with_stock`, `get_sales_analytics`, and `get_daily_sales_trend` are deployed and responding correctly.*

---

## 🚀 Running the Application

1. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.