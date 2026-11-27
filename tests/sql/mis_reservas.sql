-- HU-21/HU-22: las reservas de invitado hechas con el correo CONFIRMADO de la cuenta se ven y se pueden cambiar.
-- Termina SIEMPRE en una excepción (no queda nada escrito). Pasa si el mensaje empieza con "OK".
DO $$
DECLARE
  r          record;
  v_usuario  record;
  v_dueno    boolean; v_dueno_cambia text;
  v_sin_conf boolean; v_sin_conf_cambia text;
  v_ajeno    boolean; v_ajeno_cambia text;

BEGIN
  SELECT id_reserva, id_guest, id_barberia INTO r FROM public.reserva WHERE id_guest IS NOT NULL ORDER BY id_reserva DESC LIMIT 1;
  SELECT u.id, u.email INTO v_usuario FROM auth.users u WHERE u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.guest_usuario g WHERE g.id_barberia = r.id_barberia AND lower(g.correo) = lower(u.email))
  ORDER BY u.created_at LIMIT 1;
  -- El correo del invitado en mayúsculas: la comparación no distingue
  UPDATE public.guest_usuario SET correo = upper(v_usuario.email) WHERE id_guest = r.id_guest;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario.id, 'role', 'authenticated')::text, true);
  v_dueno := EXISTS (SELECT 1 FROM public.mis_reservas(r.id_reserva) m WHERE m.es_invitado);
  BEGIN PERFORM public.cambiar_reserva_cliente(r.id_reserva); v_dueno_cambia := 'permitido';
  EXCEPTION WHEN OTHERS THEN v_dueno_cambia := SQLSTATE; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_ajeno := EXISTS (SELECT 1 FROM public.mis_reservas(r.id_reserva));
  BEGIN PERFORM public.cambiar_reserva_cliente(r.id_reserva); v_ajeno_cambia := 'permitido';
  EXCEPTION WHEN OTHERS THEN v_ajeno_cambia := SQLSTATE; END;

  UPDATE auth.users SET email_confirmed_at = NULL WHERE id = v_usuario.id;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario.id, 'role', 'authenticated')::text, true);
  v_sin_conf := EXISTS (SELECT 1 FROM public.mis_reservas(r.id_reserva));
  BEGIN PERFORM public.cambiar_reserva_cliente(r.id_reserva); v_sin_conf_cambia := 'permitido';
  EXCEPTION WHEN OTHERS THEN v_sin_conf_cambia := SQLSTATE; END;

  RAISE EXCEPTION '%: dueño ve=% cambia=% | ajeno ve=% cambia=% | sin confirmar ve=% cambia=%',
    CASE WHEN v_dueno AND v_dueno_cambia <> '42501' AND NOT v_ajeno AND v_ajeno_cambia = '42501'
              AND NOT v_sin_conf AND v_sin_conf_cambia = '42501' THEN 'OK' ELSE 'FALLA' END,
    v_dueno, v_dueno_cambia, v_ajeno, v_ajeno_cambia, v_sin_conf, v_sin_conf_cambia;
END $$;
