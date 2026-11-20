-- =====================================================================
--  HU-24 · Sincronizar reservas con Google Calendar (T1: base de datos)
--  Migración para una base que ya tiene BDD.SQL + RLS.sql + BI.sql.
--  (La misma DDL está incorporada en BDD.SQL / RLS.sql para construir desde cero.)
--
--  Antes de activar el job (T3), crear en Vault (Dashboard → Vault, o SQL):
--    SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
--    SELECT vault.create_secret('https://projecto-barberia.vercel.app', 'site_url');
--  y luego: SELECT cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname = 'gcal-sincronizar';
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Módulo (sin precio_addon: solo llega por el plan) y Premium = el plan que tiene 'bi'
INSERT INTO public.modulo (codigo, nombre, descripcion, es_base)
VALUES ('calendario', 'Google Calendar', 'Sincroniza las reservas de cada barbero con su Google Calendar', false);
INSERT INTO public.plan_modulo (id_plan, id_modulo)
SELECT pm.id_plan, c.id_modulo
FROM public.plan_modulo pm
JOIN public.modulo bi ON bi.id_modulo = pm.id_modulo AND bi.codigo = 'bi'
CROSS JOIN public.modulo c WHERE c.codigo = 'calendario';

-- Vínculo de Google de cada persona (uno por usuario aunque atienda en varias barberías).
-- El refresh token vive en Vault (id_secreto); se escribe solo desde el backend (service role).
CREATE TABLE public.calendario_google (
  id_usuario      uuid        PRIMARY KEY REFERENCES public.usuario (id_usuario) ON DELETE CASCADE,
  email_google    text        NOT NULL,
  id_secreto      uuid        NOT NULL,   -- vault.secrets.id (nombre 'gcal_<id_usuario>')
  conectado_at    timestamptz NOT NULL DEFAULT now(),
  ultimo_error    text,
  ultimo_error_at timestamptz
);

-- Cola de sincronización: una fila por reserva; la llena el trigger, la vacía /api/google-calendar/sincronizar
CREATE TABLE public.reserva_evento_google (
  id_reserva   bigint      PRIMARY KEY REFERENCES public.reserva (id_reserva) ON DELETE CASCADE,
  id_barberia  uuid        NOT NULL REFERENCES public.barberia (id_barberia) ON DELETE CASCADE,
  id_usuario   uuid        NOT NULL REFERENCES public.calendario_google (id_usuario) ON DELETE CASCADE,
  event_id     text,                      -- id del evento en Google (NULL = aún no creado)
  pendiente    boolean     NOT NULL DEFAULT true,
  intentos     integer     NOT NULL DEFAULT 0,
  ultimo_error text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reserva_evento_google_pendiente_idx ON public.reserva_evento_google (updated_at) WHERE pendiente;
CREATE INDEX reserva_evento_google_usuario_idx   ON public.reserva_evento_google (id_usuario);
CREATE INDEX reserva_evento_google_barberia_idx  ON public.reserva_evento_google (id_barberia);

-- Encola la reserva si la barbería tiene 'calendario' y el profesional vinculó su Google
CREATE FUNCTION private.encolar_evento_google()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.barberia_tiene_modulo(NEW.id_barberia, 'calendario')
     AND EXISTS (SELECT 1 FROM public.calendario_google WHERE id_usuario = NEW.id_profesional) THEN
    INSERT INTO public.reserva_evento_google (id_reserva, id_barberia, id_usuario)
    VALUES (NEW.id_reserva, NEW.id_barberia, NEW.id_profesional)
    ON CONFLICT (id_reserva) DO UPDATE
      SET id_usuario = EXCLUDED.id_usuario, pendiente = true, intentos = 0, ultimo_error = NULL, updated_at = now();
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER reserva_encolar_google
  AFTER INSERT OR UPDATE OF estado, fecha_hora_inicio, fecha_hora_fin, id_profesional, id_sucursal ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION private.encolar_evento_google();

-- RLS: el dueño solo ve su vínculo; la cola no tiene políticas (solo service role)
ALTER TABLE public.calendario_google     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_evento_google ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendario_google_select ON public.calendario_google FOR SELECT TO authenticated
  USING (id_usuario = (SELECT auth.uid()));
REVOKE ALL ON public.calendario_google FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.calendario_google FROM authenticated;
REVOKE ALL ON public.reserva_evento_google FROM anon, authenticated;

-- Refresh token en Vault: solo el backend (service role) lo guarda, lee o borra
CREATE FUNCTION public.gcal_guardar_token(p_usuario uuid, p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'gcal_' || p_usuario;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_token, 'gcal_' || p_usuario, 'Refresh token de Google Calendar');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION public.gcal_token(p_usuario uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.decrypted_secret FROM vault.decrypted_secrets d
  JOIN public.calendario_google c ON c.id_secreto = d.id
  WHERE c.id_usuario = p_usuario;
$$;

-- Desvincula: borra el secreto y el vínculo (la cola de ese usuario cae por ON DELETE CASCADE)
CREATE FUNCTION public.gcal_borrar(p_usuario uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM vault.secrets WHERE name = 'gcal_' || p_usuario;
  DELETE FROM public.calendario_google WHERE id_usuario = p_usuario;
$$;

REVOKE EXECUTE ON FUNCTION public.gcal_guardar_token(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gcal_token(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gcal_borrar(uuid)              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_guardar_token(uuid, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.gcal_token(uuid)               TO service_role;
GRANT  EXECUTE ON FUNCTION public.gcal_borrar(uuid)              TO service_role;

-- Job cada minuto que vacía la cola. Se crea DESACTIVADO (lo activa T3 al desplegar la ruta).
-- URL y secreto se leen de Vault al ejecutarse ('site_url', 'cron_secret'): nada fijo en el job.
SELECT cron.schedule('gcal-sincronizar', '* * * * *', $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'site_url') || '/api/google-calendar/sincronizar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);
SELECT cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname = 'gcal-sincronizar';

-- =====================================================================
--  T3 · Activar la sincronización en PRODUCCIÓN (después de desplegar
--  /api/google-calendar/sincronizar con CRON_SECRET en Vercel)
--  1. Mismo valor que CRON_SECRET de Vercel, y la URL pública del sitio:
--       SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
--       SELECT vault.create_secret('https://projecto-barberia.vercel.app', 'site_url');
--     (si ya existen: SELECT vault.update_secret(id, '<valor>') FROM vault.secrets WHERE name = 'cron_secret';)
--  2. Activar el job:
--       SELECT cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname = 'gcal-sincronizar';
--  3. Revisar las ejecuciones (status_code 200 = ok, 401 = secreto distinto):
--       SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--       SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 5;
--  Pausar: SELECT cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname = 'gcal-sincronizar';
-- =====================================================================
