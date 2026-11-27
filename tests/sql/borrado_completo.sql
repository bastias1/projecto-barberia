-- HU-17/HU-24: eliminar una barbería cierra su suscripción en la misma transacción, y las citas canceladas
-- igual se sacan de Google Calendar aunque la barbería ya no tenga el módulo.
-- Termina SIEMPRE en una excepción (no queda nada escrito). Pasa si el mensaje empieza con "OK".
DO $$
DECLARE
  v_usuario uuid; v_a uuid; v_estado text;
  v_reserva bigint; v_reclamada boolean;
  fallas text[] := '{}';
BEGIN
  SELECT u.id_usuario INTO v_usuario FROM public.usuario u WHERE u.rol <> 'superadmin' AND u.deleted_at IS NULL LIMIT 1;
  UPDATE public.usuario SET prueba_usada_at = NULL WHERE id_usuario = v_usuario;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);
  v_a := public.registrar_barberia('Prueba A', 'prueba-del-' || floor(random() * 1e9)::text,
    (SELECT id_plan FROM public.plan_suscripcion WHERE es_plan_prueba), 'Central', 'Calle 1', 'Valdivia');
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM public.eliminar_barberia(v_a, v_usuario);
  SELECT estado INTO v_estado FROM public.suscripcion WHERE id_barberia = v_a;
  IF v_estado <> 'cancelada' THEN fallas := fallas || ('suscripción tras eliminar: ' || v_estado); END IF;

  -- Una cita cancelada de una barbería sin el módulo 'calendario' se reclama igual (hay que borrar su evento)
  SELECT r.id_reserva INTO v_reserva FROM public.reserva r
  WHERE r.estado = 'cancelada' AND NOT public.barberia_tiene_modulo(r.id_barberia, 'calendario') LIMIT 1;
  IF v_reserva IS NULL THEN
    SELECT r.id_reserva INTO v_reserva FROM public.reserva r WHERE r.estado = 'cancelada' LIMIT 1;
    UPDATE public.suscripcion SET estado = 'cancelada' WHERE id_barberia = (SELECT id_barberia FROM public.reserva WHERE id_reserva = v_reserva);
  END IF;
  INSERT INTO public.calendario_google (id_usuario, email_google, id_secreto)
  VALUES (v_usuario, 'prueba@pruebas.navaja.test', gen_random_uuid()) ON CONFLICT (id_usuario) DO NOTHING;
  INSERT INTO public.reserva_evento_google (id_reserva, id_barberia, id_usuario, pendiente)
  SELECT id_reserva, id_barberia, v_usuario, true FROM public.reserva WHERE id_reserva = v_reserva
  ON CONFLICT (id_reserva) DO UPDATE SET pendiente = true, bloqueada_hasta = NULL, intentos = 0;
  UPDATE public.reserva_evento_google SET pendiente = false WHERE id_reserva <> v_reserva;
  v_reclamada := EXISTS (SELECT 1 FROM public.gcal_reclamar(10) g WHERE g.id_reserva = v_reserva);
  IF NOT v_reclamada THEN fallas := fallas || 'cita cancelada sin módulo no se reclama'::text; END IF;

  RAISE EXCEPTION '%', CASE WHEN fallas = '{}' THEN 'OK' ELSE 'FALLA: ' || array_to_string(fallas, ' | ') END;
END $$;
