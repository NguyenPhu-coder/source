INSERT INTO transactions (order_id, gateway, transaction_id, amount, status, gateway_response) VALUES
(1, 'vnpay', 'VNP001234567', 299000.00, 'completed', '{}'),
(2, 'momo', 'MOMO987654321', 599000.00, 'completed', '{}'),
(3, 'vnpay', 'VNP002345678', 199000.00, 'completed', '{}'),
(4, 'momo', 'MOMO876543210', 499000.00, 'pending', NULL),
(5, 'vnpay', 'VNP003456789', 799000.00, 'failed', '{}');
