-- HU-21: tengo_clave() distingue cuentas con contraseña de las que solo entran con Google.
-- Termina SIEMPRE en una excepción (no queda nada escrito). Pasa si el mensaje empieza con "OK".
DO $$
DECLARE
  v_usuario uuid;
  v_con boolean; v_sin boolean; v_nadie boolean;
BEGIN
  SELECT id INTO v_usuario FROM auth.users WHERE coalesce(encrypted_password, '') <> '' ORDER BY created_at LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);
  v_con := public.tengo_clave();
  UPDATE auth.users SET encrypted_password = '' WHERE id = v_usuario;
  v_sin := public.tengo_clave();
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_nadie := public.tengo_clave();
  RAISE EXCEPTION '%: con=% sin=% inexistente=%', CASE WHEN v_con AND NOT v_sin AND NOT v_nadie THEN 'OK' ELSE 'FALLA' END, v_con, v_sin, v_nadie;
END $$;
