-- Database Setup Script for Tovo
-- Run this script in MySQL to create the database

-- Create the database
CREATE DATABASE IF NOT EXISTS ala_elsareea CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ala_elsareea.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;

-- Note: After running this script, execute the following commands in the backend directory:
-- 1. npm run prisma:generate
-- 2. npm run prisma:migrate (or npm run prisma:push for development)