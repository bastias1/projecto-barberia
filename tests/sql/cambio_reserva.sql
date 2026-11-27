-- HU-22: quién puede cambiar una reserva. Se ejecuta entero (Supabase SQL / MCP execute_sql):
-- termina SIEMPRE en una excepción, así que no queda nada escrito. Pasa si el mensaje empieza con "OK".
DO $$
DECLARE
  v_reserva bigint;
  v_ajeno   text;
  v_propia  text := 'sin reservas de cuenta';
  r         record;
BEGIN
  SELECT id_reserva INTO v_reserva FROM public.reserva WHERE id_guest IS NOT NULL ORDER BY id_reserva DESC LIMIT 1;
  IF v_reserva IS NULL THEN RAISE EXCEPTION 'FALLA: no hay reservas de invitado para probar'; END IF;

  -- Un usuario ajeno (con sesión) no puede tocar la reserva de un invitado
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.cambiar_reserva_cliente(v_reserva);
    v_ajeno := 'PERMITIDO';
  EXCEPTION WHEN OTHERS THEN v_ajeno := SQLSTATE || ' ' || SQLERRM;
  END;

  -- El dueño de una reserva con cuenta sigue pasando la guarda
  SELECT id_reserva, id_cliente INTO r FROM public.reserva WHERE id_cliente IS NOT NULL LIMIT 1;
  IF FOUND THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.id_cliente, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.cambiar_reserva_cliente(r.id_reserva);
      v_propia := 'permitido';
    EXCEPTION WHEN OTHERS THEN v_propia := SQLSTATE || ' ' || SQLERRM;
    END;
  END IF;

  RAISE EXCEPTION '%: ajeno=[%] dueño=[%]',
    CASE WHEN v_ajeno LIKE '42501%' AND v_propia NOT LIKE '42501%' THEN 'OK' ELSE 'FALLA' END, v_ajeno, v_propia;
END $$;
