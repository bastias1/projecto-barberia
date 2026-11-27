-- HU-17/HU-18: propietario, una sola prueba Pro por cuenta, protección de la barbería y borrado lógico.
-- Termina SIEMPRE en una excepción (no queda nada escrito). Pasa si el mensaje empieza con "OK".
DO $$
DECLARE
  v_usuario uuid;
  v_pro bigint; v_basico bigint;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid;
  v_suf text := floor(random() * 1e9)::text;
  v_estado text; v_txt text; v_marca timestamptz;
  fallas text[] := '{}';
BEGIN
  SELECT id INTO v_usuario FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM public.usuario p WHERE p.id_usuario = u.id AND p.rol <> 'superadmin') ORDER BY u.created_at LIMIT 1;
  SELECT id_plan INTO v_pro FROM public.plan_suscripcion WHERE es_plan_prueba AND activo;
  SELECT id_plan INTO v_basico FROM public.plan_suscripcion WHERE NOT es_plan_prueba AND activo ORDER BY precio_mensual DESC LIMIT 1;
  UPDATE public.usuario SET prueba_usada_at = NULL WHERE id_usuario = v_usuario;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);

  -- Sin haber usado la prueba, el plan que no es de prueba parte sin pagar y no la consume
  v_c := public.registrar_barberia('Prueba C', 'prueba-c-' || v_suf, v_basico, 'Central', 'Calle 1', 'Valdivia');
  SELECT estado INTO v_estado FROM public.suscripcion WHERE id_barberia = v_c;
  SELECT prueba_usada_at INTO v_marca FROM public.usuario WHERE id_usuario = v_usuario;
  IF v_estado <> 'vencida' OR v_marca IS NOT NULL THEN fallas := fallas || format('no-pro: %s marca=%s', v_estado, v_marca); END IF;

  v_a := public.registrar_barberia('Prueba A', 'prueba-a-' || v_suf, v_pro, 'Central', 'Calle 1', 'Valdivia');
  SELECT estado INTO v_estado FROM public.suscripcion WHERE id_barberia = v_a;
  IF v_estado <> 'prueba' THEN fallas := fallas || ('primer pro: ' || v_estado); END IF;
  IF (SELECT id_propietario FROM public.barberia WHERE id_barberia = v_a) IS DISTINCT FROM v_usuario THEN fallas := fallas || 'sin propietario'::text; END IF;

  v_b := public.registrar_barberia('Prueba B', 'prueba-b-' || v_suf, v_pro, 'Central', 'Calle 1', 'Valdivia');
  SELECT estado INTO v_estado FROM public.suscripcion WHERE id_barberia = v_b;
  IF v_estado <> 'vencida' OR (SELECT count(*) FROM public.sucursal WHERE id_barberia = v_b AND activa) <> 1 THEN
    fallas := fallas || ('segundo pro: ' || v_estado);
  END IF;

  -- El admin no puede reactivar/desactivar ni reasignar su barbería por la API
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.barberia SET activa = false WHERE id_barberia = v_a;
    v_txt := 'permitido';
  EXCEPTION WHEN insufficient_privilege THEN v_txt := '42501';
  END;
  RESET ROLE;
  IF v_txt <> '42501' THEN fallas := fallas || ('admin cambia activa: ' || v_txt); END IF;
  IF has_function_privilege('authenticated', 'public.eliminar_barberia(uuid,uuid)', 'execute') THEN fallas := fallas || 'eliminar_barberia expuesta'::text; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  BEGIN PERFORM public.eliminar_barberia(v_a, gen_random_uuid()); v_txt := 'permitido';
  EXCEPTION WHEN OTHERS THEN v_txt := SQLSTATE; END;
  IF v_txt <> '42501' THEN fallas := fallas || ('borra un ajeno: ' || v_txt); END IF;

  INSERT INTO public.pedido (id_barberia) VALUES (v_a);
  -- estado_pago lo deriva un trigger de los pagos
  INSERT INTO public.pago (id_barberia, concepto, id_pedido, monto, proveedor, estado, id_transaccion_externa)
  SELECT v_a, 'pedido', id_pedido, 1000, 'efectivo', 'aprobado', 'prueba-' || v_suf FROM public.pedido WHERE id_barberia = v_a;
  BEGIN PERFORM public.eliminar_barberia(v_a, v_usuario); v_txt := 'permitido';
  EXCEPTION WHEN OTHERS THEN v_txt := SQLERRM; END;
  IF v_txt <> 'PEDIDOS_PENDIENTES' THEN fallas := fallas || ('pedido pagado sin entregar: ' || v_txt); END IF;
  UPDATE public.pedido SET estado = 'entregado' WHERE id_barberia = v_a;

  PERFORM public.eliminar_barberia(v_a, v_usuario);
  IF NOT EXISTS (SELECT 1 FROM public.barberia WHERE id_barberia = v_a AND NOT activa AND eliminada_at IS NOT NULL AND slug LIKE 'eliminada-%')
     OR EXISTS (SELECT 1 FROM public.usuario_barberia WHERE id_barberia = v_a AND activo)
     OR NOT EXISTS (SELECT 1 FROM public.pedido WHERE id_barberia = v_a) THEN
    fallas := fallas || 'borrado incompleto'::text;
  END IF;

  -- El slug queda libre y la prueba no vuelve
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);
  v_d := public.registrar_barberia('Prueba D', 'prueba-a-' || v_suf, v_pro, 'Central', 'Calle 1', 'Valdivia');
  SELECT estado INTO v_estado FROM public.suscripcion WHERE id_barberia = v_d;
  IF v_estado <> 'vencida' THEN fallas := fallas || ('tras borrar vuelve la prueba: ' || v_estado); END IF;

  RAISE EXCEPTION '%', CASE WHEN fallas = '{}' THEN 'OK' ELSE 'FALLA: ' || array_to_string(fallas, ' | ') END;
END $$;
