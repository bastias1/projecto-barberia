-- Migration to fix schema and add addresses

-- 1. Remove circular dependency from 'venta'
ALTER TABLE public.venta DROP CONSTRAINT IF EXISTS venta_detalle_fkey;
ALTER TABLE public.venta DROP COLUMN IF EXISTS detalle;

-- 2. Add delivery fields to 'venta'
ALTER TABLE public.venta ADD COLUMN IF NOT EXISTS direccion_envio text;
ALTER TABLE public.venta ADD COLUMN IF NOT EXISTS tipo_entrega text; -- 'retiro' or 'despacho'

-- 3. Update 'detalle_venta' to link to 'venta' (1:N relationship)
-- First remove the weird FK if it exists
ALTER TABLE public.detalle_venta DROP CONSTRAINT IF EXISTS detalle_venta_id_fkey;

-- Add venta_id column
ALTER TABLE public.detalle_venta ADD COLUMN IF NOT EXISTS venta_id bigint;

-- Add FK constraint
ALTER TABLE public.detalle_venta 
    ADD CONSTRAINT detalle_venta_venta_id_fkey 
    FOREIGN KEY (venta_id) 
    REFERENCES public.venta(id)
    ON DELETE CASCADE;

-- 4. Create 'direccion_usuario' table
CREATE TABLE IF NOT EXISTS public.direccion_usuario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  nombre_etiqueta text, -- e.g. "Casa", "Trabajo"
  calle text NOT NULL,
  ciudad text NOT NULL,
  comuna text NOT NULL,
  telefono text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT direccion_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT direccion_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE
);

-- 5. Enable RLS (Optional but good practice, assuming policies will be added later)
ALTER TABLE public.direccion_usuario ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own addresses
CREATE POLICY "Users can manage their own addresses" ON public.direccion_usuario
    USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);
