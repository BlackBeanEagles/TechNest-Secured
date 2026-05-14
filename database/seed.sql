USE technest_shop;

-- Admin user: password = Admin@1234
-- User: password = User@1234
-- Passwords are bcrypt hashed (cost factor 12) — freshly generated
INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, is_active) VALUES
('admin', 'admin@technest.com', '$2a$12$VVaR8D7Y5FfNoreDShn3eOALxUCFyTeqLFDDFCW1Pnfxsp5tOs7Li', 'admin', 'Admin', 'User', '+1-555-0100', TRUE),
('johndoe', 'john@example.com', '$2a$12$tolriKlv64srgxBq4Lkx0eKC0t7NY0RWves.ED9DzCovdnsMtjCia', 'user', 'John', 'Doe', '+1-555-0101', TRUE);

-- Sample products
INSERT INTO products (name, description, price, category, image_url, stock, is_active, created_by) VALUES
('MacBook Pro 16"', 'Apple M3 Pro chip, 18GB RAM, 512GB SSD. Professional performance for demanding workflows.', 2499.99, 'Laptops', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', 15, TRUE, 1),
('iPhone 15 Pro', 'A17 Pro chip, 48MP camera system, titanium design. The most powerful iPhone ever.', 1199.99, 'Smartphones', 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400', 30, TRUE, 1),
('Sony WH-1000XM5', 'Industry-leading noise canceling, 30h battery, crystal clear calls. Premium over-ear headphones.', 349.99, 'Headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', 50, TRUE, 1),
('Samsung 4K OLED TV 65"', 'Neural Quantum Processor 4K, Infinity One Design, Object Tracking Sound. Cinematic experience at home.', 1799.99, 'TVs', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=400', 8, TRUE, 1),
('iPad Pro 12.9"', 'M2 chip, Liquid Retina XDR display, Apple Pencil support. The ultimate iPad experience.', 1099.99, 'Tablets', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400', 20, TRUE, 1),
('Canon EOS R5', '45MP full-frame sensor, 8K RAW video, Dual Pixel CMOS AF II. Professional mirrorless camera.', 3899.99, 'Cameras', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400', 5, TRUE, 1),
('Dell XPS 15', 'Intel Core i9, 32GB RAM, RTX 4070, OLED display. Power meets elegance.', 2199.99, 'Laptops', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400', 12, TRUE, 1),
('Apple Watch Ultra 2', 'Precision GPS, 60h battery, titanium case, sapphire crystal. Built for extreme athletes.', 799.99, 'Wearables', 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400', 25, TRUE, 1),
('Samsung Galaxy S24 Ultra', 'Snapdragon 8 Gen 3, 200MP camera, built-in S Pen, 12GB RAM. The ultimate Android flagship.', 1299.99, 'Smartphones', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400', 18, TRUE, 1),
('Sony PlayStation 5', '4K gaming, 120fps, ultra-high speed SSD, haptic feedback DualSense controller. Next-gen gaming.', 499.99, 'Gaming', 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400', 10, TRUE, 1),
('Bose QuietComfort 45', 'Legendary noise canceling, 24h battery, balanced sound. All-day comfort and performance.', 279.99, 'Headphones', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400', 35, TRUE, 1),
('Microsoft Surface Pro 9', 'Intel Core i7, 16GB RAM, 256GB SSD, detachable keyboard. The most versatile laptop.', 1299.99, 'Tablets', 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400', 14, TRUE, 1);
