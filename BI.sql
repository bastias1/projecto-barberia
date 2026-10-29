-- =====================================================================
-- MÓDULO BI (HU-13..15 · KPI-01..07)
-- Funciones SECURITY INVOKER: el RLS de las tablas base sigue aplicando.
-- Solo las ve el admin de una barbería con el módulo 'bi' (CP-29).
-- Se aplica con el MCP de Supabase (apply_migration); este archivo es la referencia.
-- =====================================================================

CREATE FUNCTION private.bi_verificar(p_barberia uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF NOT (private.es_admin(p_barberia) AND public.barberia_tiene_modulo(p_barberia, 'bi')) THEN
    RAISE EXCEPTION 'Sin acceso al módulo de estadísticas' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- Reservas del rango con la fecha/hora en la zona horaria de su sucursal
CREATE FUNCTION public.bi_reservas(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (id_reserva bigint, fecha date, hora integer, dow integer, estado text,
               id_servicio bigint, id_profesional uuid, monto numeric, minutos numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  PERFORM private.bi_verificar(p_barberia);
  RETURN QUERY
  SELECT x.id_reserva, x.f, extract(hour FROM x.l)::int, extract(dow FROM x.l)::int, x.estado,
         x.id_servicio, x.id_profesional, x.monto, x.minutos
  FROM (
    SELECT r.id_reserva, (r.fecha_hora_inicio AT TIME ZONE s.zona_horaria) AS l,
           (r.fecha_hora_inicio AT TIME ZONE s.zona_horaria)::date AS f,
           r.estado, r.id_servicio, r.id_profesional, r.monto::numeric AS monto,
           extract(epoch FROM r.fecha_hora_fin - r.fecha_hora_inicio) / 60 AS minutos
    FROM public.reserva r
    JOIN public.sucursal s ON s.id_barberia = r.id_barberia AND s.id_sucursal = r.id_sucursal
    -- ventana ancha que usa el índice; el filtro exacto es por fecha local
    WHERE r.id_barberia = p_barberia
      AND r.fecha_hora_inicio >= p_desde - 1 AND r.fecha_hora_inicio < p_hasta + 2
  ) x
  WHERE x.f BETWEEN p_desde AND p_hasta;
END $$;

-- Pedidos pagados; la fecha es la del primer pago aprobado (la spec no la define)
CREATE FUNCTION public.bi_pedidos_pagados(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (id_pedido bigint, fecha date, monto numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_tz text;
BEGIN
  PERFORM private.bi_verificar(p_barberia);
  SELECT zona_horaria INTO v_tz FROM public.sucursal WHERE id_barberia = p_barberia ORDER BY id_sucursal LIMIT 1;
  RETURN QUERY
  SELECT x.id_pedido, x.f, x.monto
  FROM (
    SELECT p.id_pedido, p.monto_total::numeric AS monto,
           (coalesce(pg.fecha, p.updated_at) AT TIME ZONE coalesce(s.zona_horaria, v_tz, 'America/Santiago'))::date AS f
    FROM public.pedido p
    LEFT JOIN public.sucursal s ON s.id_barberia = p.id_barberia AND s.id_sucursal = p.id_sucursal
    LEFT JOIN LATERAL (
      SELECT min(pa.created_at) AS fecha FROM public.pago pa
      WHERE pa.id_barberia = p.id_barberia AND pa.id_pedido = p.id_pedido AND pa.estado = 'aprobado'
    ) pg ON true
    -- el pago nunca es anterior al pedido: poda los pedidos posteriores al rango
    WHERE p.id_barberia = p_barberia AND p.estado_pago = 'pagado' AND p.created_at < p_hasta + 2
  ) x
  WHERE x.f BETWEEN p_desde AND p_hasta;
END $$;

-- KPI-01 · HU-13
CREATE FUNCTION public.bi_ingresos(p_barberia uuid, p_desde date, p_hasta date, p_gran text DEFAULT 'day')
RETURNS TABLE (periodo date, servicios numeric, productos numeric, total numeric, transacciones bigint)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF p_gran NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Granularidad inválida: %', p_gran USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN QUERY
  WITH m AS (
    SELECT r.fecha, 'servicio'::text AS tipo, r.monto FROM public.bi_reservas(p_barberia, p_desde, p_hasta) r
    WHERE r.estado = 'completada'
    UNION ALL
    SELECT pp.fecha, 'producto', pp.monto FROM public.bi_pedidos_pagados(p_barberia, p_desde, p_hasta) pp
  )
  SELECT date_trunc(p_gran, m.fecha)::date,
         coalesce(sum(m.monto) FILTER (WHERE m.tipo = 'servicio'), 0),
         coalesce(sum(m.monto) FILTER (WHERE m.tipo = 'producto'), 0),
         sum(m.monto), count(*)
  FROM m GROUP BY 1 ORDER BY 1;
END $$;

-- KPI-02 · HU-14
CREATE FUNCTION public.bi_servicios(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (id_servicio bigint, nombre text, cantidad bigint, ingresos numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT s.id_servicio, s.nombre, count(*), sum(r.monto)
  FROM public.bi_reservas(p_barberia, p_desde, p_hasta) r
  JOIN public.servicio s ON s.id_barberia = p_barberia AND s.id_servicio = r.id_servicio
  WHERE r.estado = 'completada'
  GROUP BY s.id_servicio, s.nombre
  ORDER BY count(*) DESC, sum(r.monto) DESC;
$$;

-- KPI-03 · HU-14
CREATE FUNCTION public.bi_productos(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (id_producto bigint, nombre text, unidades bigint, monto numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pr.id_producto, pr.nombre, sum(d.cantidad), sum(d.subtotal)
  FROM public.bi_pedidos_pagados(p_barberia, p_desde, p_hasta) pp
  JOIN public.detalle_pedido d ON d.id_barberia = p_barberia AND d.id_pedido = pp.id_pedido
  JOIN public.producto pr ON pr.id_barberia = p_barberia AND pr.id_producto = d.id_producto
  GROUP BY pr.id_producto, pr.nombre
  ORDER BY sum(d.cantidad) DESC, sum(d.subtotal) DESC;
$$;

REVOKE EXECUTE ON FUNCTION private.bi_verificar(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_reservas(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_pedidos_pagados(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_ingresos(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_servicios(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_productos(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.bi_verificar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_reservas(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_pedidos_pagados(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_ingresos(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_servicios(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_productos(uuid, date, date) TO authenticated;

-- =====================================================================
-- HU-15 · KPI-04..07
-- =====================================================================

-- KPI-04: reservas no canceladas por día de la semana (0 = domingo) y hora local
CREATE FUNCTION public.bi_demanda(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (dow integer, hora integer, citas bigint)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT r.dow, r.hora, count(*)
  FROM public.bi_reservas(p_barberia, p_desde, p_hasta) r
  WHERE r.estado <> 'cancelada'
  GROUP BY r.dow, r.hora
  ORDER BY r.dow, r.hora;
$$;

-- KPI-05: minutos reservados / minutos de atención publicados (sin días bloqueados), por profesional
CREATE FUNCTION public.bi_ocupacion(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (id_profesional uuid, nombre text, minutos_publicados numeric, minutos_reservados numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  PERFORM private.bi_verificar(p_barberia);
  RETURN QUERY
  WITH pub AS (
    SELECT ha.id_profesional AS idp,
           sum(extract(epoch FROM ha.hora_fin - ha.hora_inicio) / 60) AS min_pub
    FROM generate_series(p_desde, p_hasta, interval '1 day') g
    JOIN public.horario_atencion ha
      ON ha.id_barberia = p_barberia AND ha.activo AND ha.dia_semana = extract(dow FROM g)::int
    WHERE NOT EXISTS (
      SELECT 1 FROM public.dia_bloqueado b
      WHERE b.id_barberia = p_barberia AND b.id_profesional = ha.id_profesional AND b.fecha = g::date)
    GROUP BY ha.id_profesional
  ), res AS (
    SELECT r.id_profesional AS idp, sum(r.minutos) AS min_res
    FROM public.bi_reservas(p_barberia, p_desde, p_hasta) r
    WHERE r.estado <> 'cancelada'
      AND NOT EXISTS (
        SELECT 1 FROM public.dia_bloqueado b
        WHERE b.id_barberia = p_barberia AND b.id_profesional = r.id_profesional AND b.fecha = r.fecha)
    GROUP BY r.id_profesional
  )
  -- shortcut: citas fuera del horario publicado (p. ej. manuales) se topan en 100 %, no se recortan por franja
  SELECT pub.idp, coalesce(pr.alias, 'Profesional')::text, pub.min_pub,
         least(coalesce(res.min_res, 0), pub.min_pub)
  FROM pub
  LEFT JOIN res ON res.idp = pub.idp
  LEFT JOIN public.profesional pr ON pr.id_barberia = p_barberia AND pr.id_profesional = pub.idp
  ORDER BY least(coalesce(res.min_res, 0), pub.min_pub) / nullif(pub.min_pub, 0) DESC NULLS LAST;
END $$;

-- KPI-06 y KPI-07 por mes. tasa_no_show es NULL si no hubo completadas ni inasistencias
CREATE FUNCTION public.bi_resumen_mensual(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (mes date, ingresos numeric, transacciones bigint, ticket_promedio numeric,
               completadas bigint, no_asistio bigint, tasa_no_show numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH ing AS (
    SELECT periodo AS mes, total, transacciones FROM public.bi_ingresos(p_barberia, p_desde, p_hasta, 'month')
  ), asis AS (
    SELECT date_trunc('month', r.fecha)::date AS mes,
           count(*) FILTER (WHERE r.estado = 'completada') AS completadas,
           count(*) FILTER (WHERE r.estado = 'no_asistio') AS no_asistio
    FROM public.bi_reservas(p_barberia, p_desde, p_hasta) r
    GROUP BY 1
  )
  SELECT coalesce(i.mes, a.mes), coalesce(i.total, 0), coalesce(i.transacciones, 0),
         round(i.total / nullif(i.transacciones, 0)),
         coalesce(a.completadas, 0), coalesce(a.no_asistio, 0),
         round(100.0 * a.no_asistio / nullif(a.completadas + a.no_asistio, 0), 1)
  FROM ing i FULL JOIN asis a ON a.mes = i.mes
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.bi_demanda(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_ocupacion(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_resumen_mensual(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bi_demanda(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_ocupacion(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_resumen_mensual(uuid, date, date) TO authenticated;
