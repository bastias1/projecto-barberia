-- =====================================================================
--  Seguridad a nivel de fila (RLS) y funciones RPC
--  Plataforma SaaS multi-tenant para barberías · Proyecto TIHI84
--
--  Ejecutar DESPUÉS de esquema_completo.sql.
--
--  Modelo de acceso:
--    anon           visitante sin sesión: ve el catálogo público (barberías,
--                   sucursales, profesionales, servicios, productos, reseñas)
--                   y puede reservar como invitado mediante una RPC.
--    authenticated  usuario con sesión. Lo que ve depende de su rol en cada
--                   barbería (usuario_barberia.rol):
--                     admin        todo lo de su barbería
--                     profesional  su agenda, sus horarios y bloqueos
--                     cliente      sus propias reservas, pedidos y pagos
--                   y de su rol de plataforma (usuario.rol = 'superadmin').
--    service_role   backend (webhooks de pago, jobs de BI). Omite RLS.
--
--  Secciones:
--    1. Funciones auxiliares (esquema private, no expuesto por la API)
--    2. Activar RLS
--    3. Políticas por tabla
--    4. Restricciones de edición para clientes
--    5. Funciones RPC (registro de barbería, reserva de invitado,
--       disponibilidad, anonimización)
--    6. Permisos (GRANT / REVOKE)
-- =====================================================================

-- =====================================================================
-- 1. FUNCIONES AUXILIARES
--    SECURITY DEFINER para que las políticas puedan consultar
--    usuario_barberia sin recursión de RLS.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE FUNCTION private.es_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario
    WHERE id_usuario = (SELECT auth.uid()) AND rol = 'superadmin' AND deleted_at IS NULL
  );
$$;

-- Rol del usuario actual en una barbería (NULL si no pertenece)
CREATE FUNCTION private.rol_en_barberia(p_barberia uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT rol FROM public.usuario_barberia
  WHERE id_barberia = p_barberia AND id_usuario = (SELECT auth.uid()) AND activo;
$$;

CREATE FUNCTION private.es_admin(p_barberia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.es_superadmin()
      OR coalesce(private.rol_en_barberia(p_barberia) = 'admin', false);
$$;

-- Personal de la barbería: administradores y profesionales
CREATE FUNCTION private.es_staff(p_barberia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.es_superadmin()
      OR coalesce(private.rol_en_barberia(p_barberia) IN ('admin','profesional'), false);
$$;

-- =====================================================================
-- 2. ACTIVAR RLS EN TODAS LAS TABLAS
--    Sin una política que lo permita, una tabla no entrega ni acepta filas.
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- El superadmin de la plataforma puede operar sobre todo
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((SELECT private.es_superadmin())) WITH CHECK ((SELECT private.es_superadmin()))',
      t || '_superadmin', t);
  END LOOP;
END $$;

-- =====================================================================
-- 3. POLÍTICAS POR TABLA
-- =====================================================================

-- ---------------- Plataforma ----------------

-- barberia: pública si está activa; la edita su admin (se crea con registrar_barberia)
CREATE POLICY barberia_select_publico ON public.barberia FOR SELECT TO anon, authenticated
  USING (activa OR private.es_admin(id_barberia));
CREATE POLICY barberia_update_admin ON public.barberia FOR UPDATE TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- sucursal
CREATE POLICY sucursal_select_publico ON public.sucursal FOR SELECT TO anon, authenticated
  USING (activa OR private.es_staff(id_barberia));
CREATE POLICY sucursal_admin ON public.sucursal FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- Catálogos comerciales: lectura pública (página de precios); escritura solo superadmin
CREATE POLICY modulo_select_publico           ON public.modulo           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tipo_limite_select_publico      ON public.tipo_limite      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY plan_suscripcion_select_publico ON public.plan_suscripcion FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY plan_modulo_select_publico      ON public.plan_modulo      FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY plan_limite_select_publico      ON public.plan_limite      FOR SELECT TO anon, authenticated USING (true);

-- Suscripciones: las ve el admin; las escribe el backend (service_role) o el superadmin
CREATE POLICY suscripcion_select_admin ON public.suscripcion FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia));
CREATE POLICY suscripcion_modulo_select_admin ON public.suscripcion_modulo FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia));

-- ---------------- Usuarios ----------------

-- usuario: cada uno ve su fila; el personal ve a los miembros de su barbería
CREATE POLICY usuario_select ON public.usuario FOR SELECT TO authenticated
  USING (id_usuario = (SELECT auth.uid())
         OR EXISTS (SELECT 1 FROM public.usuario_barberia ub
                    WHERE ub.id_usuario = usuario.id_usuario
                      AND private.es_staff(ub.id_barberia)));
CREATE POLICY usuario_insert_propio ON public.usuario FOR INSERT TO authenticated
  WITH CHECK (id_usuario = (SELECT auth.uid()) AND rol = 'usuario');
CREATE POLICY usuario_update_propio ON public.usuario FOR UPDATE TO authenticated
  USING (id_usuario = (SELECT auth.uid())) WITH CHECK (id_usuario = (SELECT auth.uid()));
-- (las columnas editables se restringen con GRANT en la sección 6)

-- usuario_barberia
CREATE POLICY usuario_barberia_select ON public.usuario_barberia FOR SELECT TO authenticated
  USING (id_usuario = (SELECT auth.uid()) OR private.es_staff(id_barberia));
CREATE POLICY usuario_barberia_insert ON public.usuario_barberia FOR INSERT TO authenticated
  WITH CHECK ((id_usuario = (SELECT auth.uid()) AND rol = 'cliente')   -- unirse como cliente
              OR private.es_admin(id_barberia));                        -- el admin agrega personal
CREATE POLICY usuario_barberia_update_admin ON public.usuario_barberia FOR UPDATE TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));
CREATE POLICY usuario_barberia_delete ON public.usuario_barberia FOR DELETE TO authenticated
  USING ((id_usuario = (SELECT auth.uid()) AND rol = 'cliente') OR private.es_admin(id_barberia));

-- direccion_usuario: solo su dueño
CREATE POLICY direccion_usuario_propia ON public.direccion_usuario FOR ALL TO authenticated
  USING (id_usuario = (SELECT auth.uid())) WITH CHECK (id_usuario = (SELECT auth.uid()));

-- guest_usuario: lo ve el personal; se crea con reservar_como_invitado
CREATE POLICY guest_usuario_select_staff ON public.guest_usuario FOR SELECT TO authenticated
  USING (private.es_staff(id_barberia));
CREATE POLICY guest_usuario_update_admin ON public.guest_usuario FOR UPDATE TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- consentimiento: registro inmutable; el usuario ve e inserta los suyos
CREATE POLICY consentimiento_select_propio ON public.consentimiento FOR SELECT TO authenticated
  USING (id_usuario = (SELECT auth.uid()));
CREATE POLICY consentimiento_insert_propio ON public.consentimiento FOR INSERT TO authenticated
  WITH CHECK (id_usuario = (SELECT auth.uid()) AND id_guest IS NULL);

-- ---------------- Agenda ----------------

-- profesional: público si está activo (nombre vía profesionales_publicos())
CREATE POLICY profesional_select_publico ON public.profesional FOR SELECT TO anon, authenticated
  USING (activo OR private.es_staff(id_barberia));
CREATE POLICY profesional_admin ON public.profesional FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- servicio
CREATE POLICY servicio_select_publico ON public.servicio FOR SELECT TO anon, authenticated
  USING (activo OR private.es_staff(id_barberia));
CREATE POLICY servicio_admin ON public.servicio FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- profesional_servicio
CREATE POLICY profesional_servicio_select_publico ON public.profesional_servicio FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY profesional_servicio_admin ON public.profesional_servicio FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- profesional_sucursal: pública (para filtrar barberos al reservar); la escribe el admin
CREATE POLICY profesional_sucursal_select_publico ON public.profesional_sucursal FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY profesional_sucursal_admin ON public.profesional_sucursal FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));
CREATE POLICY profesional_sucursal_superadmin ON public.profesional_sucursal FOR ALL TO authenticated
  USING ((SELECT private.es_superadmin())) WITH CHECK ((SELECT private.es_superadmin()));

-- horario_atencion: público; lo editan el admin y el propio profesional
CREATE POLICY horario_atencion_select_publico ON public.horario_atencion FOR SELECT TO anon, authenticated
  USING (activo OR private.es_staff(id_barberia));
CREATE POLICY horario_atencion_admin ON public.horario_atencion FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));
CREATE POLICY horario_atencion_propio ON public.horario_atencion FOR ALL TO authenticated
  USING (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia))
  WITH CHECK (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia));

-- dia_bloqueado: privado (el motivo puede ser sensible); el público usa dias_bloqueados()
CREATE POLICY dia_bloqueado_select_staff ON public.dia_bloqueado FOR SELECT TO authenticated
  USING (private.es_staff(id_barberia));
CREATE POLICY dia_bloqueado_admin ON public.dia_bloqueado FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));
CREATE POLICY dia_bloqueado_propio ON public.dia_bloqueado FOR ALL TO authenticated
  USING (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia))
  WITH CHECK (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia));

-- reserva: el cliente ve las suyas, el profesional su agenda, el admin todas.
-- El público consulta disponibilidad con horarios_ocupados().
CREATE POLICY reserva_select ON public.reserva FOR SELECT TO authenticated
  USING (id_cliente = (SELECT auth.uid())
         OR private.es_admin(id_barberia)
         OR (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia)));
CREATE POLICY reserva_insert_cliente ON public.reserva FOR INSERT TO authenticated
  WITH CHECK (id_cliente = (SELECT auth.uid()) AND id_guest IS NULL AND estado = 'pendiente');
CREATE POLICY reserva_insert_staff ON public.reserva FOR INSERT TO authenticated
  WITH CHECK (private.es_staff(id_barberia));
CREATE POLICY reserva_update ON public.reserva FOR UPDATE TO authenticated
  USING (id_cliente = (SELECT auth.uid()) OR private.es_staff(id_barberia))
  WITH CHECK (id_cliente = (SELECT auth.uid()) OR private.es_staff(id_barberia));
-- (no hay DELETE: las reservas se cancelan, no se borran)

-- reserva_historial: lo escribe el trigger; lo leen el personal y el dueño de la reserva
CREATE POLICY reserva_historial_select ON public.reserva_historial FOR SELECT TO authenticated
  USING (private.es_staff(id_barberia)
         OR EXISTS (SELECT 1 FROM public.reserva r
                    WHERE r.id_barberia = reserva_historial.id_barberia
                      AND r.id_reserva  = reserva_historial.id_reserva
                      AND r.id_cliente  = (SELECT auth.uid())));

-- ---------------- Comercio ----------------

-- producto
CREATE POLICY producto_select_publico ON public.producto FOR SELECT TO anon, authenticated
  USING (activo OR private.es_staff(id_barberia));
CREATE POLICY producto_admin ON public.producto FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));

-- pedido
CREATE POLICY pedido_select ON public.pedido FOR SELECT TO authenticated
  USING (id_cliente = (SELECT auth.uid()) OR private.es_staff(id_barberia));
CREATE POLICY pedido_insert_cliente ON public.pedido FOR INSERT TO authenticated
  WITH CHECK (id_cliente = (SELECT auth.uid()) AND estado = 'pendiente');
CREATE POLICY pedido_insert_staff ON public.pedido FOR INSERT TO authenticated
  WITH CHECK (private.es_staff(id_barberia));
CREATE POLICY pedido_update ON public.pedido FOR UPDATE TO authenticated
  USING (id_cliente = (SELECT auth.uid()) OR private.es_staff(id_barberia))
  WITH CHECK (id_cliente = (SELECT auth.uid()) OR private.es_staff(id_barberia));

-- detalle_pedido: hereda el acceso del pedido
CREATE POLICY detalle_pedido_select ON public.detalle_pedido FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido p
                 WHERE p.id_barberia = detalle_pedido.id_barberia
                   AND p.id_pedido   = detalle_pedido.id_pedido));
CREATE POLICY detalle_pedido_insert ON public.detalle_pedido FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedido p
                      WHERE p.id_barberia = detalle_pedido.id_barberia
                        AND p.id_pedido   = detalle_pedido.id_pedido
                        AND (p.id_cliente = (SELECT auth.uid()) OR private.es_staff(p.id_barberia))));
CREATE POLICY detalle_pedido_delete ON public.detalle_pedido FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido p
                 WHERE p.id_barberia = detalle_pedido.id_barberia
                   AND p.id_pedido   = detalle_pedido.id_pedido
                   AND (p.id_cliente = (SELECT auth.uid()) OR private.es_staff(p.id_barberia))));

-- ---------------- Pagos ----------------

-- pago: lo escribe solo el backend (service_role); lo leen el admin y el cliente dueño
CREATE POLICY pago_select ON public.pago FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia)
         OR (id_pedido IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.pedido p
               WHERE p.id_barberia = pago.id_barberia AND p.id_pedido = pago.id_pedido
                 AND p.id_cliente = (SELECT auth.uid())))
         OR (id_reserva IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.reserva r
               WHERE r.id_barberia = pago.id_barberia AND r.id_reserva = pago.id_reserva
                 AND r.id_cliente = (SELECT auth.uid()))));

-- ---------------- Opiniones y BI ----------------

-- resena: públicas; el autor registrado crea, edita y borra las suyas; el admin modera
CREATE POLICY resena_select_publico ON public.resena FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY resena_insert_cliente ON public.resena FOR INSERT TO authenticated
  WITH CHECK (id_cliente = (SELECT auth.uid()) AND id_guest IS NULL);
CREATE POLICY resena_update_autor ON public.resena FOR UPDATE TO authenticated
  USING (id_cliente = (SELECT auth.uid())) WITH CHECK (id_cliente = (SELECT auth.uid()));
CREATE POLICY resena_delete ON public.resena FOR DELETE TO authenticated
  USING (id_cliente = (SELECT auth.uid()) OR private.es_admin(id_barberia));

-- prediccion_demanda: la escribe el job de BI (service_role); la ve el admin con módulo BI
CREATE POLICY prediccion_demanda_select_admin ON public.prediccion_demanda FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia) AND public.barberia_tiene_modulo(id_barberia, 'bi'));

-- =====================================================================
-- 4. RESTRICCIONES DE EDICIÓN PARA CLIENTES
--    RLS decide QUÉ filas se editan, no QUÉ columnas. Estos triggers
--    limitan al cliente a cancelar; el personal edita libremente.
--    (El nombre empieza con "a_" para que se ejecuten primero.)
--    Las funciones de sistema (SECURITY DEFINER) no quedan limitadas.
-- =====================================================================

-- SECURITY INVOKER a propósito: current_user es 'authenticated' solo cuando la
-- orden viene directo de la API; dentro de funciones del sistema es su dueño.
CREATE FUNCTION private.restringir_cliente_reserva()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') OR private.es_staff(NEW.id_barberia) THEN
    RETURN NEW;                                   -- backend, función del sistema o personal
  END IF;
  IF (to_jsonb(NEW) - 'estado' - 'updated_at') <> (to_jsonb(OLD) - 'estado' - 'updated_at')
     OR NEW.estado <> 'cancelada'
     OR OLD.estado NOT IN ('pendiente','confirmada') THEN
    RAISE EXCEPTION 'El cliente solo puede cancelar una reserva pendiente o confirmada'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER a_reserva_restringir_cliente
  BEFORE UPDATE ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION private.restringir_cliente_reserva();

CREATE FUNCTION private.restringir_cliente_pedido()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') OR private.es_staff(NEW.id_barberia) THEN
    RETURN NEW;                                   -- backend, función del sistema o personal
  END IF;
  IF (to_jsonb(NEW) - 'estado' - 'updated_at') <> (to_jsonb(OLD) - 'estado' - 'updated_at')
     OR NEW.estado <> 'cancelado'
     OR OLD.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'El cliente solo puede cancelar un pedido pendiente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER a_pedido_restringir_cliente
  BEFORE UPDATE ON public.pedido
  FOR EACH ROW EXECUTE FUNCTION private.restringir_cliente_pedido();

-- =====================================================================
-- 5. FUNCIONES RPC
--    Operaciones que requieren escribir en varias tablas o leer datos
--    que el usuario no ve directamente. Se llaman con supabase.rpc(...).
-- =====================================================================

-- 5.1 Alta de una barbería (onboarding): barbería + suscripción de prueba
--     + admin + primera sucursal, en una sola transacción.
CREATE FUNCTION public.registrar_barberia(
  p_nombre          text,
  p_slug            text,
  p_id_plan         bigint,
  p_sucursal        text,
  p_direccion       text,
  p_comuna          text,
  p_zona_horaria    text    DEFAULT 'America/Santiago')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_usuario  uuid := auth.uid();
  v_barberia uuid;
  v_precio   numeric;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para registrar una barbería' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT precio_mensual INTO v_precio FROM public.plan_suscripcion WHERE id_plan = p_id_plan AND activo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El plan no existe o no está disponible' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.barberia (nombre, slug) VALUES (p_nombre, p_slug)
  RETURNING id_barberia INTO v_barberia;

  INSERT INTO public.suscripcion (id_barberia, id_plan, precio_pactado, estado, fecha_termino)
  VALUES (v_barberia, p_id_plan, v_precio, 'prueba', current_date + 14);  -- fijo: la RPC es pública

  INSERT INTO public.usuario_barberia (id_usuario, id_barberia, rol)
  VALUES (v_usuario, v_barberia, 'admin');

  INSERT INTO public.sucursal (id_barberia, nombre, direccion, comuna, zona_horaria)
  VALUES (v_barberia, p_sucursal, p_direccion, p_comuna, p_zona_horaria);

  RETURN v_barberia;
END $$;

-- 5.2 Reserva sin cuenta: crea o reutiliza el invitado, registra su
--     consentimiento y crea la reserva (validada por el trigger).
CREATE FUNCTION public.reservar_como_invitado(
  p_barberia          uuid,
  p_sucursal          bigint,
  p_profesional       uuid,
  p_servicio          bigint,
  p_inicio            timestamptz,
  p_nombre            text,
  p_apellido          text,
  p_correo            text,
  p_telefono          text,
  p_acepta_privacidad boolean,
  p_version_politica  text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_guest   uuid;
  v_reserva bigint;
BEGIN
  IF NOT coalesce(p_acepta_privacidad, false) THEN
    RAISE EXCEPTION 'Debe aceptar la política de privacidad para reservar' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.barberia WHERE id_barberia = p_barberia AND activa) THEN
    RAISE EXCEPTION 'La barbería no existe o no está activa' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.guest_usuario (id_barberia, nombre, apellido, correo, telefono)
  VALUES (p_barberia, p_nombre, p_apellido, p_correo, p_telefono)
  ON CONFLICT (id_barberia, lower(correo)) DO NOTHING
  RETURNING id_guest INTO v_guest;
  IF v_guest IS NULL THEN
    SELECT id_guest INTO v_guest FROM public.guest_usuario
    WHERE id_barberia = p_barberia AND lower(correo) = lower(p_correo);
  END IF;

  INSERT INTO public.consentimiento (id_guest, tipo, version_politica, aceptado)
  VALUES (v_guest, 'privacidad', p_version_politica, true);

  INSERT INTO public.reserva (id_barberia, id_sucursal, id_guest, id_profesional, id_servicio, fecha_hora_inicio)
  VALUES (p_barberia, p_sucursal, v_guest, p_profesional, p_servicio, p_inicio)
  RETURNING id_reserva INTO v_reserva;

  RETURN v_reserva;
END $$;

-- 5.3 Disponibilidad pública: tramos ocupados de un profesional (sin datos del cliente)
CREATE FUNCTION public.horarios_ocupados(
  p_barberia uuid, p_profesional uuid, p_desde timestamptz, p_hasta timestamptz)
RETURNS TABLE (inicio timestamptz, fin timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_hasta - p_desde > interval '62 days' THEN
    RAISE EXCEPTION 'El rango máximo de consulta es de 62 días' USING ERRCODE = 'check_violation';
  END IF;
  RETURN QUERY
  SELECT r.fecha_hora_inicio, r.fecha_hora_fin
  FROM public.reserva r
  WHERE r.id_profesional = p_profesional            -- en cualquier barbería: es la misma persona
    AND r.estado <> 'cancelada'
    AND r.fecha_hora_inicio < p_hasta
    AND r.fecha_hora_fin    > p_desde
    AND EXISTS (SELECT 1 FROM public.profesional p
                WHERE p.id_barberia = p_barberia AND p.id_profesional = p_profesional AND p.activo)
  ORDER BY 1;
END $$;

-- 5.4 Días bloqueados de un profesional (sin el motivo)
CREATE FUNCTION public.dias_bloqueados(
  p_barberia uuid, p_profesional uuid, p_desde date, p_hasta date)
RETURNS SETOF date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.fecha FROM public.dia_bloqueado d
  WHERE d.id_barberia = p_barberia AND d.id_profesional = p_profesional
    AND d.fecha BETWEEN p_desde AND least(p_hasta, p_desde + 62)
  ORDER BY 1;
$$;

-- 5.5 Derecho de supresión (Ley 21.719): anonimiza al usuario y conserva
--     reservas, pedidos y pagos sin datos personales (obligaciones contables).
--     auth.users se anonimiza y bloquea desde eliminarDatosPersona (app/admin/actions.ts).
CREATE FUNCTION public.anonimizar_usuario(p_usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text;
BEGIN
  IF p_usuario IS DISTINCT FROM auth.uid() AND NOT private.es_superadmin() THEN
    RAISE EXCEPTION 'Solo el titular o un superadmin puede eliminar la cuenta' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT email INTO v_email FROM public.usuario WHERE id_usuario = p_usuario;

  UPDATE public.usuario
  SET nombre = 'Usuario eliminado', apellido = NULL,
      email = 'eliminado-' || id_usuario || '@anon.invalid',
      telefono = NULL, profile_image = NULL, rut = NULL, deleted_at = now()
  WHERE id_usuario = p_usuario;

  DELETE FROM public.direccion_usuario WHERE id_usuario = p_usuario;
  UPDATE public.usuario_barberia SET activo = false WHERE id_usuario = p_usuario;
  UPDATE public.profesional      SET activo = false WHERE id_profesional = p_usuario;

  -- Cancela sus reservas futuras y borra direcciones de despacho guardadas
  UPDATE public.reserva SET estado = 'cancelada'
  WHERE id_cliente = p_usuario AND estado IN ('pendiente','confirmada') AND fecha_hora_inicio > now();
  UPDATE public.reserva SET notas = NULL WHERE id_cliente = p_usuario AND notas IS NOT NULL;
  UPDATE public.pedido
  SET direccion_envio = CASE WHEN tipo_entrega = 'despacho' THEN '[dirección eliminada]' END
  WHERE id_cliente = p_usuario AND estado IN ('entregado','cancelado');
  UPDATE public.resena SET comentario = NULL WHERE id_cliente = p_usuario;

  UPDATE public.invitacion
  SET correo = 'eliminado-' || id_invitacion || '@anon.invalid',
      estado = CASE WHEN estado = 'pendiente' THEN 'cancelada' ELSE estado END
  WHERE lower(correo) = lower(v_email);
END $$;

CREATE FUNCTION public.anonimizar_guest(p_guest uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_barberia uuid;
BEGIN
  SELECT id_barberia INTO v_barberia FROM public.guest_usuario WHERE id_guest = p_guest;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT private.es_admin(v_barberia) THEN
    RAISE EXCEPTION 'Solo el administrador de la barbería puede anonimizar invitados' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.guest_usuario
  SET nombre = 'Invitado eliminado', apellido = '-',
      correo = 'eliminado-' || id_guest || '@anon.invalid', telefono = NULL
  WHERE id_guest = p_guest;
  UPDATE public.reserva SET estado = 'cancelada'
  WHERE id_guest = p_guest AND estado IN ('pendiente','confirmada') AND fecha_hora_inicio > now();
  UPDATE public.reserva SET notas = NULL WHERE id_guest = p_guest AND notas IS NOT NULL;
  UPDATE public.resena SET comentario = NULL WHERE id_guest = p_guest;
END $$;

-- =====================================================================
-- 6. PERMISOS
-- =====================================================================

GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- usuario: el titular solo edita sus datos de perfil (no rol, email ni deleted_at)
REVOKE UPDATE ON public.usuario FROM anon, authenticated;
GRANT  UPDATE (nombre, apellido, telefono, profile_image, rut) ON public.usuario TO authenticated;

-- Funciones internas: no se exponen como RPC (los triggers las usan como dueño)
REVOKE EXECUTE ON FUNCTION public.asegurar_membresia_cliente(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido(uuid, bigint)  FROM PUBLIC, anon, authenticated;

-- RPC públicas
REVOKE EXECUTE ON FUNCTION public.registrar_barberia(text, text, bigint, text, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_barberia(text, text, bigint, text, text, text, text) TO authenticated;

GRANT  EXECUTE ON FUNCTION public.reservar_como_invitado(uuid, bigint, uuid, bigint, timestamptz, text, text, text, text, boolean, text) TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.horarios_ocupados(uuid, uuid, timestamptz, timestamptz) TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.dias_bloqueados(uuid, uuid, date, date)                 TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.anonimizar_usuario(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.anonimizar_guest(uuid)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.anonimizar_usuario(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.anonimizar_guest(uuid)   TO authenticated;

GRANT  EXECUTE ON FUNCTION public.profesionales_publicos(uuid) TO anon, authenticated;

-- =====================================================================
-- Storage (bucket público "imgs"): cada admin escribe solo en la carpeta
-- de su barbería; cada usuario, solo su avatar
-- =====================================================================
CREATE POLICY imgs_productos_admin ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'productos'
         AND (private.es_superadmin() OR EXISTS (
           SELECT 1 FROM public.usuario_barberia ub
           WHERE ub.id_usuario = (SELECT auth.uid()) AND ub.rol = 'admin' AND ub.activo
             AND ub.id_barberia::text = (storage.foldername(name))[2])))
  WITH CHECK (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'productos'
         AND (private.es_superadmin() OR EXISTS (
           SELECT 1 FROM public.usuario_barberia ub
           WHERE ub.id_usuario = (SELECT auth.uid()) AND ub.rol = 'admin' AND ub.activo
             AND ub.id_barberia::text = (storage.foldername(name))[2])));

CREATE POLICY imgs_barberia_admin ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'barberias'
         AND (private.es_superadmin() OR EXISTS (
           SELECT 1 FROM public.usuario_barberia ub
           WHERE ub.id_usuario = (SELECT auth.uid()) AND ub.rol = 'admin' AND ub.activo
             AND ub.id_barberia::text = (storage.foldername(name))[2])))
  WITH CHECK (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'barberias'
         AND (private.es_superadmin() OR EXISTS (
           SELECT 1 FROM public.usuario_barberia ub
           WHERE ub.id_usuario = (SELECT auth.uid()) AND ub.rol = 'admin' AND ub.activo
             AND ub.id_barberia::text = (storage.foldername(name))[2])));

CREATE POLICY imgs_avatar_propio ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'avatars'
         AND storage.filename(name) LIKE (SELECT auth.uid())::text || '-%')
  WITH CHECK (bucket_id = 'imgs' AND (storage.foldername(name))[1] = 'avatars'
         AND storage.filename(name) LIKE (SELECT auth.uid())::text || '-%');

-- Realtime: avisos de reservas en el dashboard (respeta las políticas de reserva)
ALTER PUBLICATION supabase_realtime ADD TABLE public.reserva;

-- invitacion: el admin gestiona las de su barbería; el invitado ve las de su correo
ALTER TABLE public.invitacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitacion_admin ON public.invitacion FOR ALL TO authenticated
  USING (private.es_admin(id_barberia)) WITH CHECK (private.es_admin(id_barberia));
CREATE POLICY invitacion_select_invitado ON public.invitacion FOR SELECT TO authenticated
  USING (correo = lower((SELECT auth.jwt() ->> 'email')));
CREATE POLICY invitacion_superadmin ON public.invitacion FOR ALL TO authenticated
  USING ((SELECT private.es_superadmin())) WITH CHECK ((SELECT private.es_superadmin()));

REVOKE EXECUTE ON FUNCTION public.responder_invitacion(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.responder_invitacion(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.modulos_barberia(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.modulos_barberia(uuid) TO anon, authenticated, service_role;

-- auditoria_admin: solo el superadmin lee y agrega filas (a su nombre). Sin UPDATE/DELETE.
ALTER TABLE public.auditoria_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditoria_admin_select ON public.auditoria_admin FOR SELECT TO authenticated
  USING ((SELECT private.es_superadmin()));
CREATE POLICY auditoria_admin_insert ON public.auditoria_admin FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.es_superadmin()) AND id_usuario = (SELECT auth.uid()));
REVOKE UPDATE, DELETE, TRUNCATE ON public.auditoria_admin FROM anon, authenticated;
