-- Add active column to products table for soft delete
ALTER TABLE public.productos ADD COLUMN active BOOLEAN DEFAULT true;

-- Update existing products to be active
UPDATE public.productos SET active = true WHERE active IS NULL;
