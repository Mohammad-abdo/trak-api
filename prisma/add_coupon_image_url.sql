-- Add image_url to coupons for slider offers
ALTER TABLE coupons ADD COLUMN image_url VARCHAR(512) NULL AFTER description_ar;
