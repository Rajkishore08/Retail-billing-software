-- This script sets up demo data and handles user profile creation

-- Create a function to safely create demo profiles
CREATE OR REPLACE FUNCTION create_demo_profiles()
RETURNS void AS $$
DECLARE
    admin_id uuid;
    manager_id uuid;
    cashier_id uuid;
BEGIN
    -- Try to find existing users by email
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@nationalmart.com' LIMIT 1;
    SELECT id INTO manager_id FROM auth.users WHERE email = 'manager@nationalmart.com' LIMIT 1;
    SELECT id INTO cashier_id FROM auth.users WHERE email = 'cashier@nationalmart.com' LIMIT 1;
    
    -- Create profiles for existing users
    IF admin_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, full_name, role) 
        VALUES (admin_id, 'admin@nationalmart.com', 'Admin User', 'admin')
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'Admin User',
            role = 'admin';
    END IF;
    
    IF manager_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, full_name, role) 
        VALUES (manager_id, 'manager@nationalmart.com', 'Manager User', 'manager')
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'Manager User',
            role = 'manager';
    END IF;
    
    IF cashier_id IS NOT NULL THEN
        INSERT INTO profiles (id, email, full_name, role) 
        VALUES (cashier_id, 'cashier@nationalmart.com', 'Cashier User', 'cashier')
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'Cashier User',
            role = 'cashier';
    END IF;
    
    RAISE NOTICE 'Demo profiles setup completed';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT create_demo_profiles();

-- Add more sample products for testing
INSERT INTO products (name, barcode, price, stock_quantity, category_id, gst_rate) VALUES
('Coca Cola 500ml', 'CC500ML', 40.00, 100, (SELECT id FROM categories WHERE name = 'Beverages'), 12.00),
('Pepsi 500ml', 'PP500ML', 40.00, 80, (SELECT id FROM categories WHERE name = 'Beverages'), 12.00),
('Maggi Noodles', 'MG2MIN', 15.00, 200, (SELECT id FROM categories WHERE name = 'Groceries'), 5.00),
('Bread Loaf', 'BREAD01', 25.00, 50, (SELECT id FROM categories WHERE name = 'Groceries'), 5.00),
('Milk 1L', 'MILK1L', 60.00, 30, (SELECT id FROM categories WHERE name = 'Groceries'), 5.00),
('Notebook A4', 'NB-A4', 80.00, 25, (SELECT id FROM categories WHERE name = 'Stationery'), 12.00),
('Pen Blue', 'PEN-BL', 10.00, 150, (SELECT id FROM categories WHERE name = 'Stationery'), 12.00),
('Shampoo 200ml', 'SH200ML', 120.00, 40, (SELECT id FROM categories WHERE name = 'Personal Care'), 18.00),
('Soap Bar', 'SOAP01', 35.00, 60, (SELECT id FROM categories WHERE name = 'Personal Care'), 18.00),
('Rice 1kg', 'RICE1KG', 80.00, 100, (SELECT id FROM categories WHERE name = 'Groceries'), 5.00)
ON CONFLICT (barcode) DO NOTHING;

-- Create some sample transactions for demo data
DO $$
DECLARE
    sample_cashier_id uuid;
    sample_product_id uuid;
    transaction_id uuid;
BEGIN
    -- Get a cashier ID (any user will do for demo)
    SELECT id INTO sample_cashier_id FROM profiles LIMIT 1;
    
    IF sample_cashier_id IS NOT NULL THEN
        -- Create a sample transaction
        INSERT INTO transactions (
            invoice_number,
            cashier_id,
            customer_name,
            subtotal,
            gst_amount,
            total_amount,
            payment_method,
            cash_received,
            change_amount,
            status
        ) VALUES (
            'NMM-000001',
            sample_cashier_id,
            'Walk-in Customer',
            100.00,
            18.00,
            118.00,
            'cash',
            120.00,
            2.00,
            'completed'
        ) RETURNING id INTO transaction_id;
        
        -- Add transaction items
        SELECT id INTO sample_product_id FROM products WHERE name = 'Coca Cola 500ml' LIMIT 1;
        
        IF sample_product_id IS NOT NULL THEN
            INSERT INTO transaction_items (
                transaction_id,
                product_id,
                product_name,
                quantity,
                unit_price,
                total_price,
                gst_rate
            ) VALUES (
                transaction_id,
                sample_product_id,
                'Coca Cola 500ml',
                2,
                40.00,
                80.00,
                12.00
            );
        END IF;
    END IF;
END $$;

-- Wrap the final RAISE NOTICE in a DO block
DO $$
BEGIN
    RAISE NOTICE 'Demo data setup completed successfully!';
END $$;
