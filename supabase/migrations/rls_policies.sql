-- Enable RLS on tables
ALTER TABLE public.venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_venta ENABLE ROW LEVEL SECURITY;

-- Policy for 'venta' table

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins and Owners can view all sales" ON public.venta;
DROP POLICY IF EXISTS "Users can view their own sales" ON public.venta;

-- Allow admins and owners to view all sales
CREATE POLICY "Admins and Owners can view all sales"
ON public.venta
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario
    WHERE usuario.id = auth.uid()
    AND usuario.rol IN ('admin', 'owner')
  )
);

-- Allow users to view their own sales
CREATE POLICY "Users can view their own sales"
ON public.venta
FOR SELECT
USING (
  auth.uid() = usuario
);

-- Policy for 'detalle_venta' table

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins and Owners can view all sale details" ON public.detalle_venta;
DROP POLICY IF EXISTS "Users can view details of their own sales" ON public.detalle_venta;

-- Allow admins and owners to view all sale details
CREATE POLICY "Admins and Owners can view all sale details"
ON public.detalle_venta
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuario
    WHERE usuario.id = auth.uid()
    AND usuario.rol IN ('admin', 'owner')
  )
);

-- Allow users to view details of their own sales
CREATE POLICY "Users can view details of their own sales"
ON public.detalle_venta
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venta
    WHERE venta.id = detalle_venta.venta_id
    AND venta.usuario = auth.uid()
  )
);
