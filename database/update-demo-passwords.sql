-- One-time fix: demo bcrypt hashes must match Admin@1234 and User@1234.
-- Run in MySQL Workbench or: mysql -u root -p technest_shop < database/update-demo-passwords.sql

USE technest_shop;

UPDATE users SET password_hash = '$2a$12$VVaR8D7Y5FfNoreDShn3eOALxUCFyTeqLFDDFCW1Pnfxsp5tOs7Li' WHERE username = 'admin';
UPDATE users SET password_hash = '$2a$12$tolriKlv64srgxBq4Lkx0eKC0t7NY0RWves.ED9DzCovdnsMtjCia' WHERE username = 'johndoe';
