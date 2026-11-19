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
    -- El superadmin de la plataforma puede operar sobre todo, salvo las tablas de solo
    -- lectura/registro (sus políticas propias están más abajo)
    CONTINUE WHEN t IN ('auditoria_admin', 'movimiento_stock', 'calendario_google', 'reserva_evento_google');
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
-- (profesional_sucursal_superadmin la crea el bucle de la sección 2)

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

-- movimiento_stock: solo lectura para el admin; lo escribe el trigger de producto
CREATE POLICY movimiento_stock_select ON public.movimiento_stock FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia) OR (SELECT private.es_superadmin()));
REVOKE ALL ON public.movimiento_stock FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.movimiento_stock FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ingresar_stock(bigint, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ingresar_stock(bigint, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reclamar_alertas_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reclamar_alertas_stock(uuid) TO service_role;

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
  -- HU-22: mismo plazo que cambiar_reserva_cliente
  IF OLD.fecha_hora_inicio - now() < make_interval(mins => (SELECT b.plazo_cancelacion_min FROM public.barberia b
                                                            WHERE b.id_barberia = OLD.id_barberia)) THEN
    RAISE EXCEPTION 'FUERA_DE_PLAZO' USING ERRCODE = 'check_violation';
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

-- 5.2b Reserva con cuenta (HU-02): a nombre del usuario con sesión
--      (la política ya se aceptó al crear la cuenta).
CREATE FUNCTION public.reservar_con_cuenta(p_barberia uuid, p_sucursal bigint, p_profesional uuid,
                                           p_servicio bigint, p_inicio timestamptz)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_usuario  uuid := auth.uid();
  v_correo   text;
  v_telefono text;
  v_reserva  bigint;
BEGIN
  SELECT u.email, u.telefono INTO v_correo, v_telefono
  FROM public.usuario u WHERE u.id_usuario = v_usuario AND u.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debe iniciar sesión para reservar con su cuenta' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.barberia WHERE id_barberia = p_barberia AND activa) THEN
    RAISE EXCEPTION 'La barbería no existe o no está activa' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT public.barberia_tiene_modulo(p_barberia, 'agenda') THEN
    RAISE EXCEPTION 'Esta barbería no está recibiendo reservas en línea' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cliente_bloqueado b
             WHERE b.id_barberia = p_barberia
               AND (b.correo = lower(trim(v_correo))
                    OR (nullif(regexp_replace(coalesce(v_telefono, ''), '\D', '', 'g'), '') IS NOT NULL
                        AND regexp_replace(coalesce(b.telefono, ''), '\D', '', 'g')
                          = regexp_replace(v_telefono, '\D', '', 'g')))) THEN
    RAISE EXCEPTION 'CLIENTE_BLOQUEADO' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.asegurar_membresia_cliente(p_barberia, v_usuario);

  INSERT INTO public.reserva (id_barberia, id_sucursal, id_cliente, id_profesional, id_servicio, fecha_hora_inicio)
  VALUES (p_barberia, p_sucursal, v_usuario, p_profesional, p_servicio, p_inicio)
  RETURNING id_reserva INTO v_reserva;

  RETURN v_reserva;
END $$;
REVOKE EXECUTE ON FUNCTION public.reservar_con_cuenta(uuid, bigint, uuid, bigint, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reservar_con_cuenta(uuid, bigint, uuid, bigint, timestamptz) TO authenticated;

-- 5.2c HU-22: el cliente cancela (p_nuevo_inicio NULL) o reprograma su reserva, solo hasta
--      barberia.plazo_cancelacion_min antes de la cita. La llama su dueño con sesión, o el
--      backend con service role tras verificar el link firmado del correo.
CREATE FUNCTION public.cambiar_reserva_cliente(p_reserva bigint, p_nuevo_inicio timestamptz DEFAULT NULL,
                                               p_sucursal bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r       public.reserva;
  v_plazo integer;
BEGIN
  SELECT * INTO r FROM public.reserva WHERE id_reserva = p_reserva FOR UPDATE;
  IF NOT FOUND OR NOT (coalesce(auth.role(), '') = 'service_role' OR r.id_cliente = auth.uid()) THEN
    RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.estado NOT IN ('pendiente', 'confirmada') THEN
    RAISE EXCEPTION 'Esta reserva ya no se puede modificar' USING ERRCODE = 'check_violation';
  END IF;
  SELECT b.plazo_cancelacion_min INTO v_plazo FROM public.barberia b WHERE b.id_barberia = r.id_barberia;
  IF r.fecha_hora_inicio - now() < make_interval(mins => v_plazo) THEN
    RAISE EXCEPTION 'FUERA_DE_PLAZO' USING ERRCODE = 'check_violation';
  END IF;

  IF p_nuevo_inicio IS NULL THEN
    UPDATE public.reserva SET estado = 'cancelada' WHERE id_reserva = p_reserva;
  ELSE
    IF p_nuevo_inicio <= now() THEN
      RAISE EXCEPTION 'La nueva hora debe ser futura' USING ERRCODE = 'check_violation';
    END IF;
    -- validar_reserva revisa el horario y la restricción de exclusión, que no se cruce con otra cita
    UPDATE public.reserva
    SET fecha_hora_inicio = p_nuevo_inicio, id_sucursal = coalesce(p_sucursal, id_sucursal)
    WHERE id_reserva = p_reserva;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.cambiar_reserva_cliente(bigint, timestamptz, bigint) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cambiar_reserva_cliente(bigint, timestamptz, bigint) TO authenticated, service_role;
GRANT  UPDATE (plazo_cancelacion_min) ON public.barberia TO authenticated;  -- lo edita el admin (RLS) en Mi Barbería

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

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;  -- service_role: triggers en private (p. ej. al actualizar reserva)

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

-- HU-11: promedio y número de reseñas de una barbería activa (público, sin datos de clientes)
CREATE FUNCTION public.resumen_resenas(p_barberia uuid)
RETURNS TABLE (promedio numeric, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT round(avg(r.calificacion), 1), count(*)::integer
  FROM public.resena r
  JOIN public.barberia b ON b.id_barberia = r.id_barberia AND b.activa
  WHERE r.id_barberia = p_barberia;
$$;
REVOKE EXECUTE ON FUNCTION public.resumen_resenas(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resumen_resenas(uuid) TO anon, authenticated;

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
-- (invitacion_superadmin la crea el bucle de la sección 2)

-- Definiciones que solo existían en la BD (copiadas de producción, 2026-11-18) ----------------

-- Invitación: normaliza el correo, exige suscripción vigente, rechaza miembros y respeta max_profesionales
CREATE FUNCTION private.validar_invitacion()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_max      integer;
  v_ocupados integer;
BEGIN
  NEW.correo := lower(trim(NEW.correo));
  NEW.estado := 'pendiente';
  NEW.invitado_por := coalesce(NEW.invitado_por, auth.uid());

  IF NEW.correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El correo no es válido' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suscripcion s
                 WHERE s.id_barberia = NEW.id_barberia AND s.estado IN ('prueba','activa')
                   AND (s.fecha_termino IS NULL OR s.fecha_termino >= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Necesitas una suscripción activa para invitar a tu equipo' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuario_barberia ub
             JOIN public.usuario u ON u.id_usuario = ub.id_usuario
             WHERE ub.id_barberia = NEW.id_barberia AND ub.activo
               AND ub.rol IN ('admin','profesional') AND lower(u.email) = NEW.correo) THEN
    RAISE EXCEPTION 'Esa persona ya es parte del equipo' USING ERRCODE = 'check_violation';
  END IF;

  -- Una invitación pendiente pero vencida no bloquea una nueva
  UPDATE public.invitacion SET estado = 'cancelada'
  WHERE id_barberia = NEW.id_barberia AND correo = NEW.correo
    AND estado = 'pendiente' AND expira_at < now();

  IF NEW.rol = 'profesional' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.id_barberia::text || 'profesional'));
    v_max := public.barberia_limite(NEW.id_barberia, 'max_profesionales');
    IF v_max IS NOT NULL THEN
      SELECT (SELECT count(*) FROM public.profesional p WHERE p.id_barberia = NEW.id_barberia AND p.activo)
           + (SELECT count(*) FROM public.invitacion i
              WHERE i.id_barberia = NEW.id_barberia AND i.rol = 'profesional'
                AND i.estado = 'pendiente' AND i.expira_at >= now())
        INTO v_ocupados;
      IF v_ocupados >= v_max THEN
        RAISE EXCEPTION 'Tu plan permite como máximo % barberos (contando invitaciones pendientes)', v_max
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER a_invitacion_validar BEFORE INSERT ON public.invitacion
  FOR EACH ROW EXECUTE FUNCTION private.validar_invitacion();

-- Aceptar o rechazar una invitación (solo el dueño del correo, confirmado); devuelve el slug
CREATE FUNCTION public.responder_invitacion(p_token uuid, p_aceptar boolean)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_email  text;
  v_meta   jsonb;
  v_inv    public.invitacion%ROWTYPE;
  v_slug   text;
  v_suc    bigint[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT lower(email), raw_user_meta_data INTO v_email, v_meta
  FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Confirma tu correo antes de responder la invitación' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_inv FROM public.invitacion WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_inv.correo <> v_email THEN
    RAISE EXCEPTION 'Esta invitación no es para tu cuenta' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_inv.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta invitación ya fue %', v_inv.estado USING ERRCODE = 'check_violation';
  END IF;
  IF v_inv.expira_at < now() THEN
    RAISE EXCEPTION 'Esta invitación venció; pide una nueva' USING ERRCODE = 'check_violation';
  END IF;

  SELECT slug INTO v_slug FROM public.barberia WHERE id_barberia = v_inv.id_barberia;

  IF NOT p_aceptar THEN
    UPDATE public.invitacion SET estado = 'rechazada', respondida_at = now() WHERE id_invitacion = v_inv.id_invitacion;
    RETURN v_slug;
  END IF;

  -- Perfil de usuario (por si aún no existe)
  INSERT INTO public.usuario (id_usuario, nombre, apellido, email)
  VALUES (v_uid, coalesce(nullif(v_meta ->> 'nombre', ''), split_part(v_email, '@', 1)),
          nullif(v_meta ->> 'apellido', ''), v_email)
  ON CONFLICT (id_usuario) DO NOTHING;

  INSERT INTO public.usuario_barberia (id_usuario, id_barberia, rol, activo)
  VALUES (v_uid, v_inv.id_barberia, v_inv.rol, true)
  ON CONFLICT (id_usuario, id_barberia) DO UPDATE SET rol = EXCLUDED.rol, activo = true;

  IF v_inv.rol = 'profesional' THEN
    -- El trigger de límites del plan valida el cupo de barberos
    INSERT INTO public.profesional (id_barberia, id_profesional, activo)
    VALUES (v_inv.id_barberia, v_uid, true)
    ON CONFLICT (id_barberia, id_profesional) DO UPDATE SET activo = true;

    -- Con una sola sucursal activa queda asignado a ella
    SELECT array_agg(id_sucursal) INTO v_suc FROM public.sucursal
    WHERE id_barberia = v_inv.id_barberia AND activa;
    IF array_length(v_suc, 1) = 1 THEN
      INSERT INTO public.profesional_sucursal (id_barberia, id_profesional, id_sucursal)
      VALUES (v_inv.id_barberia, v_uid, v_suc[1])
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE public.invitacion SET estado = 'aceptada', respondida_at = now() WHERE id_invitacion = v_inv.id_invitacion;
  RETURN v_slug;
END $function$;

-- Módulos vigentes de una barbería (RPC pública)
CREATE FUNCTION public.modulos_barberia(p_barberia uuid)
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT coalesce(array_agg(DISTINCT codigo ORDER BY codigo), '{}')
  FROM public.v_barberia_modulo WHERE id_barberia = p_barberia;
$function$;

-- Reseñas públicas de una barbería activa (autor abreviado)
CREATE FUNCTION public.resenas_publicas(p_barberia uuid, p_limite integer DEFAULT 10)
 RETURNS TABLE(id_resena bigint, calificacion smallint, comentario text, created_at timestamp with time zone,
               autor text, profesional text, servicio text, producto text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT r.id_resena, r.calificacion, r.comentario, r.created_at,
         coalesce(
           CASE WHEN u.deleted_at IS NULL THEN trim(u.nombre || coalesce(' ' || left(u.apellido, 1) || '.', '')) END,
           trim(g.nombre || coalesce(' ' || nullif(left(g.apellido, 1), '-') || '.', '')),
           'Cliente'),
         coalesce(p.alias::text, nullif(trim(up.nombre || ' ' || coalesce(up.apellido, '')), '')),
         s.nombre::text,
         pr.nombre
  FROM public.resena r
  JOIN public.barberia b             ON b.id_barberia = r.id_barberia AND b.activa
  LEFT JOIN public.usuario u         ON u.id_usuario = r.id_cliente
  LEFT JOIN public.guest_usuario g   ON g.id_barberia = r.id_barberia AND g.id_guest = r.id_guest
  LEFT JOIN public.profesional p     ON p.id_barberia = r.id_barberia AND p.id_profesional = r.id_profesional
  LEFT JOIN public.usuario up        ON up.id_usuario = r.id_profesional
  LEFT JOIN public.servicio s        ON s.id_barberia = r.id_barberia AND s.id_servicio = r.id_servicio
  LEFT JOIN public.producto pr       ON pr.id_barberia = r.id_barberia AND pr.id_producto = r.id_producto
  WHERE r.id_barberia = p_barberia
  ORDER BY r.created_at DESC
  LIMIT least(greatest(coalesce(p_limite, 10), 1), 200);
$function$;
GRANT EXECUTE ON FUNCTION public.resenas_publicas(uuid, integer) TO anon, authenticated;

-- El profesional edita su ficha, pero solo el admin cambia activo / barbería / persona
CREATE FUNCTION private.restringir_profesional_propio()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
BEGIN
  IF current_user NOT IN ('anon','authenticated') OR private.es_admin(OLD.id_barberia) THEN
    RETURN NEW;
  END IF;
  IF NEW.activo IS DISTINCT FROM OLD.activo
     OR NEW.id_barberia <> OLD.id_barberia
     OR NEW.id_profesional <> OLD.id_profesional THEN
    RAISE EXCEPTION 'Solo el administrador puede cambiar el estado del profesional'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER a_profesional_restringir_propio BEFORE UPDATE ON public.profesional
  FOR EACH ROW EXECUTE FUNCTION private.restringir_profesional_propio();

-- Clientes bloqueados por la barbería (los revisa reservar_como_invitado); los gestiona el staff
CREATE TABLE public.cliente_bloqueado (
  id_bloqueo    bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_barberia   uuid        NOT NULL REFERENCES public.barberia(id_barberia) ON DELETE CASCADE,
  correo        text        NOT NULL CHECK (correo = lower(correo)),
  telefono      text,
  razon         text,
  bloqueado_por uuid        REFERENCES public.usuario(id_usuario) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_bloqueado_correo_uk UNIQUE (id_barberia, correo)
);
CREATE INDEX cliente_bloqueado_telefono_idx ON public.cliente_bloqueado (id_barberia, telefono) WHERE telefono IS NOT NULL;
ALTER TABLE public.cliente_bloqueado ENABLE ROW LEVEL SECURITY;
CREATE POLICY cliente_bloqueado_staff ON public.cliente_bloqueado FOR ALL TO authenticated
  USING (private.es_staff(id_barberia)) WITH CHECK (private.es_staff(id_barberia));
-- ------------------------------------------------------------------------------------------

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

-- ---------------- HU-24 · Google Calendar (migración HU24.sql) ----------------
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

