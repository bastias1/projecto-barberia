-- =====================================================================
--  HU-25 · Pronóstico de demanda (T1: base de datos)
--  Migración para una base que ya tiene BDD.SQL + RLS.sql + BI.sql + HU24.sql.
--  (La misma DDL está incorporada en BDD.SQL / RLS.sql para construir desde cero.)
--  El modelo corre fuera de la app (ml/pronostico.py, service role) y solo escribe aquí.
-- =====================================================================

-- Módulo sin precio_addon (solo llega por el plan, CP-50); Premium = el plan que tiene 'bi'
INSERT INTO public.modulo (codigo, nombre, descripcion, es_base)
VALUES ('pronostico', 'Pronóstico de demanda', 'Estimación de reservas e ingresos de las próximas semanas', false);
INSERT INTO public.plan_modulo (id_plan, id_modulo)
SELECT pm.id_plan, c.id_modulo
FROM public.plan_modulo pm
JOIN public.modulo bi ON bi.id_modulo = pm.id_modulo AND bi.codigo = 'bi'
CROSS JOIN public.modulo c WHERE c.codigo = 'pronostico';

-- Margen de error y una fila por (barbería, tipo, fecha): el job re-escribe con upsert
ALTER TABLE public.prediccion_demanda
  ADD COLUMN valor_min numeric,
  ADD COLUMN valor_max numeric,
  ADD CONSTRAINT prediccion_demanda_rango_check CHECK (valor_min <= valor_estimado AND valor_estimado <= valor_max);
CREATE UNIQUE INDEX prediccion_unica ON public.prediccion_demanda (id_barberia, tipo, fecha_objetivo)
  WHERE tipo <> 'producto';

DROP TRIGGER prediccion_requiere_bi ON public.prediccion_demanda;
CREATE TRIGGER prediccion_requiere_pronostico
  BEFORE INSERT ON public.prediccion_demanda
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('pronostico');

DROP POLICY prediccion_demanda_select_admin ON public.prediccion_demanda;
CREATE POLICY prediccion_demanda_select_admin ON public.prediccion_demanda FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia) AND public.barberia_tiene_modulo(id_barberia, 'pronostico'));

-- Historial diario para entrenar (fechas en la zona horaria de la sucursal). Los bi_* exigen
-- auth.uid(), por eso el job usa esta función, solo service role.
-- reservas = citas no canceladas; ingresos = monto de las completadas (sin productos: v1).
CREATE FUNCTION public.historial_demanda(p_barberia uuid, p_desde date, p_hasta date)
RETURNS TABLE (fecha date, reservas bigint, ingresos numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (r.fecha_hora_inicio AT TIME ZONE s.zona_horaria)::date,
         count(*) FILTER (WHERE r.estado <> 'cancelada'),
         coalesce(sum(r.monto::numeric) FILTER (WHERE r.estado = 'completada'), 0)
  FROM public.reserva r
  JOIN public.sucursal s ON s.id_barberia = r.id_barberia AND s.id_sucursal = r.id_sucursal
  WHERE r.id_barberia = p_barberia
    AND r.fecha_hora_inicio >= p_desde - 1 AND r.fecha_hora_inicio < p_hasta + 2
    AND (r.fecha_hora_inicio AT TIME ZONE s.zona_horaria)::date BETWEEN p_desde AND p_hasta
  GROUP BY 1 ORDER BY 1
$$;
REVOKE EXECUTE ON FUNCTION public.historial_demanda(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.historial_demanda(uuid, date, date) TO service_role;
