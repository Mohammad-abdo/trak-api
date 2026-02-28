-- Add image_url to coupons (slider offers)
ALTER TABLE coupons ADD COLUMN image_url VARCHAR(512) NULL AFTER description_ar;

-- Add image_url to service_categories (main categories)
ALTER TABLE service_categories ADD COLUMN image_url VARCHAR(512) NULL AFTER icon;
