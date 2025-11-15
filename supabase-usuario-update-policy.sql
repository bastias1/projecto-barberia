-- Drop existing UPDATE policy if exists
DROP POLICY IF EXISTS "Users can update own data or admin/owner can update others" ON public.usuario;

-- Create UPDATE policy for usuario table
-- Allows users to update their own data
-- Allows admin/owner to update other admin/owner/barbero users
CREATE POLICY "Users can update own data or admin/owner can update others"
ON public.usuario
FOR UPDATE
USING (
  -- User can update their own record
  auth.uid() = id
  OR
  -- Admin/Owner can update other users
  public.user_has_role(ARRAY['admin', 'owner'])
)
WITH CHECK (
  -- User can update their own record
  auth.uid() = id
  OR
  -- Admin/Owner can update other users
  public.user_has_role(ARRAY['admin', 'owner'])
);

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'usuario' AND cmd = 'UPDATE';
