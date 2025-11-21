-- Migration for Profile Settings

-- 1. Add 'rut' to 'usuario' table (will store encrypted text)
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS rut text;

-- 2. Add 'region' and 'depto' to 'direccion_usuario' table
ALTER TABLE public.direccion_usuario ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.direccion_usuario ADD COLUMN IF NOT EXISTS depto text;
