-- Demo Data for National Mini Mart POS System
-- This script adds sample data for testing the system

-- Insert demo products
INSERT INTO products (name, price, cost_price, mrp, selling_price, stock_quantity, min_stock_level, gst_rate, hsn_code, brand, barcode) VALUES
('Biscuits', 25.00, 15.00, 30.00, 25.00, 100, 10, 18, '19053100', 'Britannia', '8901234567890'),
('Milk', 60.00, 45.00, 70.00, 60.00, 50, 5, 18, '04011000', 'Amul', '8901234567891'),
('Bread', 35.00, 25.00, 40.00, 35.00, 30, 5, 18, '19053100', 'Britannia', '8901234567892'),
('Eggs (12)', 80.00, 60.00, 90.00, 80.00, 25, 5, 18, '04072100', 'Farm Fresh', '8901234567893'),
('Rice (5kg)', 250.00, 200.00, 280.00, 250.00, 20, 5, 18, '10063000', 'India Gate', '8901234567894'),
('Sugar (1kg)', 45.00, 35.00, 50.00, 45.00, 40, 5, 18, '17019900', 'Sakthi', '8901234567895'),
('Tea Powder', 120.00, 90.00, 140.00, 120.00, 30, 5, 18, '09024000', 'Tata', '8901234567896'),
('Cooking Oil', 180.00, 140.00, 200.00, 180.00, 25, 5, 18, '15079000', 'Fortune', '8901234567897'),
('Soap', 25.00, 15.00, 30.00, 25.00, 60, 10, 18, '34011100', 'Lux', '8901234567898'),
('Toothpaste', 85.00, 60.00, 95.00, 85.00, 40, 5, 18, '33061000', 'Colgate', '8901234567899'),
('Shampoo', 120.00, 80.00, 140.00, 120.00, 30, 5, 18, '33059000', 'Head & Shoulders', '8901234567900'),
('Detergent', 95.00, 70.00, 110.00, 95.00, 35, 5, 18, '34022000', 'Surf Excel', '8901234567901'),
('Chocolate', 50.00, 35.00, 60.00, 50.00, 45, 10, 18, '18063200', 'Cadbury', '8901234567902'),
('Chips', 20.00, 12.00, 25.00, 20.00, 80, 15, 18, '19041000', 'Lay''s', '8901234567903'),
('Soft Drink', 35.00, 25.00, 40.00, 35.00, 70, 10, 18, '22021000', 'Coca Cola', '8901234567904')
ON CONFLICT (hsn_code) DO NOTHING;

-- Insert demo customers
INSERT INTO customers (name, phone, email, loyalty_points, total_spent) VALUES
('Rajesh Kumar', '+91 9876543210', 'rajesh@email.com', 150, 2500.00),
('Priya Sharma', '+91 9876543211', 'priya@email.com', 200, 3200.00),
('Amit Patel', '+91 9876543212', 'amit@email.com', 75, 1800.00),
('Sneha Reddy', '+91 9876543213', 'sneha@email.com', 300, 4500.00),
('Vikram Singh', '+91 9876543214', 'vikram@email.com', 120, 2100.00),
('Anjali Gupta', '+91 9876543215', 'anjali@email.com', 180, 2800.00),
('Rahul Verma', '+91 9876543216', 'rahul@email.com', 90, 1600.00),
('Meera Iyer', '+91 9876543217', 'meera@email.com', 250, 3800.00)
ON CONFLICT (phone) DO NOTHING;

-- Insert demo transactions (last 7 days)
INSERT INTO transactions (invoice_number, cashier_id, customer_id, subtotal, gst_amount, total, discount_amount, discount_percentage, total_savings, payment_method, cash_received, change_amount, loyalty_points_earned, loyalty_points_redeemed, loyalty_discount_amount, created_at) VALUES
('NM 0001', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543210'), 180.00, 32.40, 212.40, 10.00, 5.00, 25.00, 'cash', 220.00, 7.60, 2, 0, 0, NOW() - INTERVAL '6 days'),
('NM 0002', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543211'), 320.00, 57.60, 377.60, 0, 0, 40.00, 'card', 377.60, 0, 3, 0, 0, NOW() - INTERVAL '5 days'),
('NM 0003', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543212'), 150.00, 27.00, 177.00, 5.00, 3.00, 20.00, 'upi', 177.00, 0, 1, 0, 0, NOW() - INTERVAL '4 days'),
('NM 0004', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543213'), 450.00, 81.00, 531.00, 20.00, 4.00, 65.00, 'cash', 550.00, 19.00, 5, 0, 0, NOW() - INTERVAL '3 days'),
('NM 0005', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543214'), 280.00, 50.40, 330.40, 0, 0, 35.00, 'card', 330.40, 0, 3, 0, 0, NOW() - INTERVAL '2 days'),
('NM 0006', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543215'), 195.00, 35.10, 230.10, 10.00, 5.00, 30.00, 'upi', 230.10, 0, 2, 0, 0, NOW() - INTERVAL '1 day'),
('NM 0007', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543216'), 420.00, 75.60, 495.60, 15.00, 3.00, 55.00, 'cash', 500.00, 4.40, 4, 0, 0, NOW() - INTERVAL '12 hours'),
('NM 0008', NULL, (SELECT id FROM customers WHERE phone = '+91 9876543217'), 310.00, 55.80, 365.80, 0, 0, 40.00, 'card', 365.80, 0, 3, 0, 0, NOW() - INTERVAL '6 hours')
ON CONFLICT (invoice_number) DO NOTHING;

-- Insert demo transaction items
INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, selling_price, item_discount_amount, item_discount_percentage, cost_price, mrp, total) VALUES
-- Transaction 1
((SELECT id FROM transactions WHERE invoice_number = 'NM 0001'), (SELECT id FROM products WHERE name = 'Biscuits'), 2, 25.00, 25.00, 0, 0, 15.00, 30.00, 50.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0001'), (SELECT id FROM products WHERE name = 'Milk'), 2, 60.00, 60.00, 0, 0, 45.00, 70.00, 120.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0001'), (SELECT id FROM products WHERE name = 'Bread'), 1, 35.00, 35.00, 0, 0, 25.00, 40.00, 35.00),

-- Transaction 2
((SELECT id FROM transactions WHERE invoice_number = 'NM 0002'), (SELECT id FROM products WHERE name = 'Rice (5kg)'), 1, 250.00, 250.00, 0, 0, 200.00, 280.00, 250.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0002'), (SELECT id FROM products WHERE name = 'Sugar (1kg)'), 1, 45.00, 45.00, 0, 0, 35.00, 50.00, 45.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0002'), (SELECT id FROM products WHERE name = 'Tea Powder'), 1, 120.00, 120.00, 0, 0, 90.00, 140.00, 120.00),

-- Transaction 3
((SELECT id FROM transactions WHERE invoice_number = 'NM 0003'), (SELECT id FROM products WHERE name = 'Eggs (12)'), 1, 80.00, 80.00, 0, 0, 60.00, 90.00, 80.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0003'), (SELECT id FROM products WHERE name = 'Bread'), 2, 35.00, 35.00, 0, 0, 25.00, 40.00, 70.00),

-- Transaction 4
((SELECT id FROM transactions WHERE invoice_number = 'NM 0004'), (SELECT id FROM products WHERE name = 'Cooking Oil'), 1, 180.00, 180.00, 0, 0, 140.00, 200.00, 180.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0004'), (SELECT id FROM products WHERE name = 'Rice (5kg)'), 1, 250.00, 250.00, 0, 0, 200.00, 280.00, 250.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0004'), (SELECT id FROM products WHERE name = 'Sugar (1kg)'), 1, 45.00, 45.00, 0, 0, 35.00, 50.00, 45.00),

-- Transaction 5
((SELECT id FROM transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM products WHERE name = 'Soap'), 2, 25.00, 25.00, 0, 0, 15.00, 30.00, 50.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM products WHERE name = 'Toothpaste'), 1, 85.00, 85.00, 0, 0, 60.00, 95.00, 85.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM products WHERE name = 'Shampoo'), 1, 120.00, 120.00, 0, 0, 80.00, 140.00, 120.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM products WHERE name = 'Detergent'), 1, 95.00, 95.00, 0, 0, 70.00, 110.00, 95.00),

-- Transaction 6
((SELECT id FROM transactions WHERE invoice_number = 'NM 0006'), (SELECT id FROM products WHERE name = 'Chocolate'), 2, 50.00, 50.00, 0, 0, 35.00, 60.00, 100.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0006'), (SELECT id FROM products WHERE name = 'Chips'), 3, 20.00, 20.00, 0, 0, 12.00, 25.00, 60.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0006'), (SELECT id FROM products WHERE name = 'Soft Drink'), 1, 35.00, 35.00, 0, 0, 25.00, 40.00, 35.00),

-- Transaction 7
((SELECT id FROM transactions WHERE invoice_number = 'NM 0007'), (SELECT id FROM products WHERE name = 'Milk'), 3, 60.00, 60.00, 0, 0, 45.00, 70.00, 180.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0007'), (SELECT id FROM products WHERE name = 'Bread'), 2, 35.00, 35.00, 0, 0, 25.00, 40.00, 70.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0007'), (SELECT id FROM products WHERE name = 'Eggs (12)'), 2, 80.00, 80.00, 0, 0, 60.00, 90.00, 160.00),

-- Transaction 8
((SELECT id FROM transactions WHERE invoice_number = 'NM 0008'), (SELECT id FROM products WHERE name = 'Tea Powder'), 1, 120.00, 120.00, 0, 0, 90.00, 140.00, 120.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0008'), (SELECT id FROM products WHERE name = 'Sugar (1kg)'), 2, 45.00, 45.00, 0, 0, 35.00, 50.00, 90.00),
((SELECT id FROM transactions WHERE invoice_number = 'NM 0008'), (SELECT id FROM products WHERE name = 'Cooking Oil'), 1, 180.00, 180.00, 0, 0, 140.00, 200.00, 180.00);

-- Insert demo loyalty transactions
INSERT INTO loyalty_transactions (customer_id, transaction_id, points_earned, points_redeemed, discount_amount, transaction_type) VALUES
((SELECT id FROM customers WHERE phone = '+91 9876543210'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0001'), 2, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543211'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0002'), 3, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543212'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0003'), 1, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543213'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0004'), 5, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543214'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0005'), 3, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543215'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0006'), 2, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543216'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0007'), 4, 0, 0, 'earned'),
((SELECT id FROM customers WHERE phone = '+91 9876543217'), (SELECT id FROM transactions WHERE invoice_number = 'NM 0008'), 3, 0, 0, 'earned');

-- Refresh dashboard stats
SELECT refresh_dashboard_stats();

-- Success message
SELECT 'Demo data inserted successfully!' as message; 