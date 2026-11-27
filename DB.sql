-- =====================================================================
--  DB.sql — Base de datos completa · Plataforma SaaS multi-tenant para barberías
--  Proyecto TIHI84 · PostgreSQL 15+ (Supabase)
--
--  UN SOLO archivo para construir la base desde cero, en este orden:
--    PARTE 1  Esquema: tablas, restricciones, índices, triggers, reglas de negocio,
--             vistas, Google Calendar (HU-24) y pronóstico (HU-25)
--    PARTE 2  Seguridad: RLS, políticas, funciones RPC, Storage y Realtime
--    PARTE 3  Estadísticas: funciones bi_* (módulo BI)
--
--  Las migraciones sueltas HU24.sql y HU25.sql ya estaban incorporadas en las
--  partes 1 y 2, así que se eliminaron. Los cambios nuevos se aplican con el MCP
--  de Supabase (apply_migration) y se reflejan aquí.
--  Para cambiar la firma de una función bi_* hay que DROP + CREATE.
-- =====================================================================


-- #####################################################################
-- PARTE 1 · ESQUEMA (tablas, triggers, reglas de negocio, vistas)
-- #####################################################################

-- =====================================================================
--  Esquema completo v3 — Plataforma SaaS multi-tenant para barberías
--  Proyecto TIHI84 · PostgreSQL 15+ (Supabase)
--
--  Crea la base de datos desde cero, en orden de dependencias.
--  Las políticas de acceso (RLS) y las funciones RPC están en la PARTE 2 de este archivo,
--  que se ejecuta DESPUÉS de esta parte.
--
--  Secciones:
--    0. Extensiones, tipos y utilidades
--    1. Plataforma ........ barberia, sucursal, modulo, tipo_limite,
--                           plan_suscripcion, plan_modulo, plan_limite,
--                           suscripcion, suscripcion_modulo
--    2. Usuarios .......... usuario, usuario_barberia, direccion_usuario,
--                           guest_usuario, consentimiento
--    3. Agenda ............ profesional, servicio, profesional_servicio,
--                           horario_atencion, dia_bloqueado, reserva,
--                           reserva_historial
--    4. Comercio .......... producto, pedido, detalle_pedido
--    5. Pagos ............. pago
--    6. Opiniones y BI .... resena, prediccion_demanda
--    7. Índices de llaves foráneas
--    8. Reglas de suscripción (módulos y límites)
--    9. Reglas de negocio (agenda, stock, pagos, reseñas, auditoría)
--   10. Vistas y consultas públicas
--
--  Convenciones:
--    - Toda tabla de dominio lleva id_barberia y FK compuestas
--      (id_barberia, id_x) para que la BD impida mezclar barberías.
--    - created_at / updated_at en todas las tablas que cambian.
--    - Montos en pesos chilenos sin decimales (dominio monto_clp).
--    - Estados como listas cerradas (CHECK).
-- =====================================================================

-- =====================================================================
-- 0. EXTENSIONES, TIPOS Y UTILIDADES
-- =====================================================================

-- btree_gist: restricciones anti-solape (en Supabase va al esquema extensions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
  ELSE
    CREATE EXTENSION IF NOT EXISTS btree_gist;
  END IF;
END $$;

-- Monto en pesos chilenos: entero, no negativo
CREATE DOMAIN public.monto_clp AS numeric(12,0)
  CONSTRAINT monto_clp_no_negativo CHECK (VALUE >= 0);

-- "Hoy" de la plataforma = fecha de Chile (igual que DEFAULT_TZ en lib/barberia.ts). La vigencia de las
-- suscripciones usa esta fecha y no current_date (UTC): así coincide con estadoSuscripcion (lib/suscripcion.ts).
CREATE FUNCTION public.hoy_chile()
RETURNS date LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'America/Santiago')::date
$$;

-- Valida un nombre de zona horaria IANA (p. ej. 'America/Santiago')
CREATE FUNCTION public.es_zona_horaria_valida(p_tz text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  PERFORM now() AT TIME ZONE p_tz;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$;

-- Mantiene updated_at (se asigna a cada tabla en la sección 9)
CREATE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- =====================================================================
-- 1. PLATAFORMA
-- =====================================================================

-- Empresa cliente de la plataforma (tenant)
CREATE TABLE public.barberia (
  id_barberia    uuid        NOT NULL DEFAULT gen_random_uuid(),
  nombre         varchar     NOT NULL,
  slug           text        NOT NULL,              -- subdominio / ruta del tenant
  telefono       text,
  email_contacto text,
  -- Contenido público de la página /<slug>
  logo_url        text,
  logo_oscuro_url text,
  eslogan         text,
  descripcion     text,
  instagram       text,
  galeria         text[]      NOT NULL DEFAULT '{}',
  plazo_cancelacion_min integer NOT NULL DEFAULT 120   -- HU-22: anticipación mínima para que el cliente cancele o reprograme
    CONSTRAINT barberia_plazo_cancelacion_check CHECK (plazo_cancelacion_min >= 0),
  apariencia     jsonb       NOT NULL DEFAULT '{}'     -- secciones de la página pública (lib/apariencia.ts)
    CONSTRAINT barberia_apariencia_check CHECK (jsonb_typeof(apariencia) = 'object' AND pg_column_size(apariencia) < 8192),
  activa         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barberia_pkey PRIMARY KEY (id_barberia),
  CONSTRAINT barberia_slug_key UNIQUE (slug),
  CONSTRAINT barberia_slug_formato CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- El slug es el primer segmento de la URL: no puede chocar con rutas de la plataforma
  CONSTRAINT barberia_slug_no_reservado CHECK (slug <> ALL (ARRAY[
    'api','auth','login','signup','registro','resena','error','private','dashboard',
    'admin','superadmin','static','public','www','app','planes','precios','ayuda',
    'soporte','contacto','terminos','privacidad','cuenta','perfil','profile','invitacion',
    'eliminar-datos','reembolsos','cookies','barberias','buscar',
    -- rutas del sitio antiguo, redirigidas a /benjvmin/... (next.config.ts)
    'agendar','tienda','cart','carrito','checkout','booking-confirmed','booking-cancelled'
  ]))
);

-- Local físico de una barbería (una barbería puede tener varios)
CREATE TABLE public.sucursal (
  id_sucursal  bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia  uuid        NOT NULL,
  nombre       varchar     NOT NULL,
  direccion    text        NOT NULL,
  comuna       text        NOT NULL,
  region       text,
  telefono     text,
  zona_horaria text        NOT NULL DEFAULT 'America/Santiago',
  activa       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sucursal_pkey PRIMARY KEY (id_sucursal),
  CONSTRAINT sucursal_tenant_uk UNIQUE (id_barberia, id_sucursal),
  CONSTRAINT sucursal_nombre_key UNIQUE (id_barberia, nombre),
  CONSTRAINT sucursal_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT sucursal_zona_horaria_valida CHECK (public.es_zona_horaria_valida(zona_horaria))
);

-- Catálogo de MÓDULOS funcionales. Agregar un módulo = insertar una fila.
CREATE TABLE public.modulo (
  id_modulo    bigint           GENERATED ALWAYS AS IDENTITY,
  codigo       text             NOT NULL,         -- clave estable: 'agenda', 'ecommerce', 'bi'
  nombre       varchar          NOT NULL,
  descripcion  text,
  es_base      boolean          NOT NULL DEFAULT false,  -- incluido en toda suscripción vigente
  precio_addon public.monto_clp,                  -- precio mensual como adicional; NULL = no se vende suelto
  activo       boolean          NOT NULL DEFAULT true,
  created_at   timestamptz      NOT NULL DEFAULT now(),
  updated_at   timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT modulo_pkey PRIMARY KEY (id_modulo),
  CONSTRAINT modulo_codigo_key UNIQUE (codigo),
  CONSTRAINT modulo_codigo_formato CHECK (codigo ~ '^[a-z0-9_]+$')
);

-- Catálogo de LÍMITES cuantitativos que un plan puede fijar
CREATE TABLE public.tipo_limite (
  id_tipo_limite bigint  GENERATED ALWAYS AS IDENTITY,
  codigo         text    NOT NULL,                -- 'max_profesionales', 'max_sucursales', ...
  nombre         varchar NOT NULL,
  unidad         text,
  id_modulo      bigint,                          -- módulo al que pertenece (NULL = general)
  CONSTRAINT tipo_limite_pkey PRIMARY KEY (id_tipo_limite),
  CONSTRAINT tipo_limite_codigo_key UNIQUE (codigo),
  CONSTRAINT tipo_limite_codigo_formato CHECK (codigo ~ '^[a-z0-9_]+$'),
  CONSTRAINT tipo_limite_id_modulo_fkey FOREIGN KEY (id_modulo) REFERENCES public.modulo(id_modulo)
);

-- Plan comercial: solo nombre y precio; lo que incluye vive en plan_modulo / plan_limite
CREATE TABLE public.plan_suscripcion (
  id_plan        bigint           GENERATED ALWAYS AS IDENTITY,
  nombre         varchar          NOT NULL,
  descripcion    text,
  precio_mensual public.monto_clp NOT NULL,
  activo         boolean          NOT NULL DEFAULT true,   -- false = no se ofrece a nuevos clientes
  created_at     timestamptz      NOT NULL DEFAULT now(),
  updated_at     timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT plan_suscripcion_pkey PRIMARY KEY (id_plan),
  CONSTRAINT plan_suscripcion_nombre_key UNIQUE (nombre)
);

-- Módulos incluidos en cada plan (N:M)
CREATE TABLE public.plan_modulo (
  id_plan   bigint NOT NULL,
  id_modulo bigint NOT NULL,
  CONSTRAINT plan_modulo_pkey PRIMARY KEY (id_plan, id_modulo),
  CONSTRAINT plan_modulo_id_plan_fkey   FOREIGN KEY (id_plan)   REFERENCES public.plan_suscripcion(id_plan) ON DELETE CASCADE,
  CONSTRAINT plan_modulo_id_modulo_fkey FOREIGN KEY (id_modulo) REFERENCES public.modulo(id_modulo)
);

-- Valor de cada límite en cada plan. Sin fila = sin límite.
CREATE TABLE public.plan_limite (
  id_plan        bigint  NOT NULL,
  id_tipo_limite bigint  NOT NULL,
  valor          integer NOT NULL,
  CONSTRAINT plan_limite_pkey PRIMARY KEY (id_plan, id_tipo_limite),
  CONSTRAINT plan_limite_id_plan_fkey        FOREIGN KEY (id_plan)        REFERENCES public.plan_suscripcion(id_plan) ON DELETE CASCADE,
  CONSTRAINT plan_limite_id_tipo_limite_fkey FOREIGN KEY (id_tipo_limite) REFERENCES public.tipo_limite(id_tipo_limite),
  CONSTRAINT plan_limite_valor_check CHECK (valor >= 0)
);

-- Suscripción de una barbería a un plan
CREATE TABLE public.suscripcion (
  id_suscripcion          bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia             uuid             NOT NULL,
  id_plan                 bigint           NOT NULL,
  precio_pactado          public.monto_clp NOT NULL,   -- precio congelado al contratar
  fecha_inicio            date             NOT NULL DEFAULT public.hoy_chile(),
  fecha_termino           date,
  estado                  text             NOT NULL DEFAULT 'activa',
  id_suscripcion_externa  text,                        -- id de la suscripción recurrente en la pasarela
  aviso_enviado           text,                        -- último aviso de vencimiento enviado ("por_vencer:<fecha_termino>")
  created_at              timestamptz      NOT NULL DEFAULT now(),
  updated_at              timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT suscripcion_pkey PRIMARY KEY (id_suscripcion),
  CONSTRAINT suscripcion_tenant_uk UNIQUE (id_barberia, id_suscripcion),
  CONSTRAINT suscripcion_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT suscripcion_id_plan_fkey     FOREIGN KEY (id_plan)     REFERENCES public.plan_suscripcion(id_plan),
  CONSTRAINT suscripcion_estado_check CHECK (estado IN ('prueba','activa','vencida','cancelada')),
  CONSTRAINT suscripcion_fechas CHECK (fecha_termino IS NULL OR fecha_termino >= fecha_inicio)
);
-- Una sola suscripción vigente por barbería
CREATE UNIQUE INDEX suscripcion_una_vigente
  ON public.suscripcion (id_barberia) WHERE estado IN ('prueba','activa');

-- Módulos adicionales contratados fuera del plan (sobreviven a un cambio de plan)
CREATE TABLE public.suscripcion_modulo (
  id_suscripcion_modulo  bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia            uuid             NOT NULL,
  id_modulo              bigint           NOT NULL,
  precio_pactado         public.monto_clp NOT NULL,
  fecha_inicio           date             NOT NULL DEFAULT public.hoy_chile(),
  fecha_termino          date,
  estado                 text             NOT NULL DEFAULT 'activo',
  id_suscripcion_externa text,
  created_at             timestamptz      NOT NULL DEFAULT now(),
  updated_at             timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT suscripcion_modulo_pkey PRIMARY KEY (id_suscripcion_modulo),
  CONSTRAINT suscripcion_modulo_tenant_uk UNIQUE (id_barberia, id_suscripcion_modulo),
  CONSTRAINT suscripcion_modulo_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT suscripcion_modulo_id_modulo_fkey   FOREIGN KEY (id_modulo)   REFERENCES public.modulo(id_modulo),
  CONSTRAINT suscripcion_modulo_estado_check CHECK (estado IN ('activo','cancelado')),
  CONSTRAINT suscripcion_modulo_fechas CHECK (fecha_termino IS NULL OR fecha_termino >= fecha_inicio)
);
-- Un mismo adicional no puede estar activo dos veces
CREATE UNIQUE INDEX suscripcion_modulo_uno_activo
  ON public.suscripcion_modulo (id_barberia, id_modulo) WHERE estado = 'activo';

-- Catálogo inicial (los planes comerciales y sus precios se definen después)
INSERT INTO public.modulo (codigo, nombre, descripcion, es_base) VALUES
  ('agenda',    'Agenda y reservas',       'Sucursales, profesionales, servicios, horarios y reservas en línea', true),
  ('ecommerce', 'Tienda en línea',         'Catálogo de productos, pedidos y pagos',                            false),
  ('bi',        'Inteligencia de negocio', 'Indicadores y predicción de demanda',                              false),
  ('calendario','Google Calendar',         'Sincroniza las reservas de cada barbero con su Google Calendar',  false),
  ('pronostico','Pronóstico de demanda',   'Estimación de reservas e ingresos de las próximas semanas',       false);

INSERT INTO public.tipo_limite (codigo, nombre, unidad, id_modulo)
SELECT v.codigo, v.nombre, v.unidad, m.id_modulo
FROM (VALUES
  ('max_sucursales',    'Sucursales activas',    'sucursales',    'agenda'),
  ('max_profesionales', 'Profesionales activos', 'profesionales', 'agenda'),
  ('max_productos',     'Productos activos',     'productos',     'ecommerce')
) AS v(codigo, nombre, unidad, modulo)
JOIN public.modulo m ON m.codigo = v.modulo;

-- =====================================================================
-- 2. USUARIOS
-- =====================================================================

-- Cuenta global de la plataforma (1:1 con auth.users de Supabase)
CREATE TABLE public.usuario (
  id_usuario    uuid        NOT NULL,
  nombre        varchar     NOT NULL,
  apellido      varchar,
  email         varchar     NOT NULL,
  telefono      text,
  rol           varchar     NOT NULL DEFAULT 'usuario',  -- rol de PLATAFORMA
  profile_image text,
  rut           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,                             -- cuenta eliminada / anonimizada
  CONSTRAINT usuario_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT usuario_id_fkey FOREIGN KEY (id_usuario) REFERENCES auth.users(id),
  CONSTRAINT usuario_rol_check CHECK (rol IN ('superadmin','usuario'))
);

-- Pertenencia de un usuario a una barbería, con su rol dentro de ella
CREATE TABLE public.usuario_barberia (
  id_usuario  uuid        NOT NULL,
  id_barberia uuid        NOT NULL,
  rol         text        NOT NULL,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_barberia_pkey PRIMARY KEY (id_barberia, id_usuario),
  CONSTRAINT usuario_barberia_id_usuario_fkey  FOREIGN KEY (id_usuario)  REFERENCES public.usuario(id_usuario)   ON DELETE CASCADE,
  CONSTRAINT usuario_barberia_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia) ON DELETE CASCADE,
  CONSTRAINT usuario_barberia_rol_check CHECK (rol IN ('admin','profesional','cliente'))
);

-- Direcciones del usuario (globales: se reutilizan en cualquier barbería)
CREATE TABLE public.direccion_usuario (
  id_direccion    uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_usuario      uuid        NOT NULL,
  nombre_etiqueta text,
  calle           text        NOT NULL,
  depto           text,
  comuna          text        NOT NULL,
  ciudad          text        NOT NULL,
  region          text,
  telefono        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direccion_usuario_pkey PRIMARY KEY (id_direccion),
  CONSTRAINT direccion_usuario_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON DELETE CASCADE
);

-- Cliente invitado (reserva sin cuenta); pertenece a una barbería
CREATE TABLE public.guest_usuario (
  id_guest    uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_barberia uuid        NOT NULL,
  nombre      varchar     NOT NULL,
  apellido    varchar     NOT NULL,
  correo      varchar     NOT NULL,
  telefono    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_usuario_pkey PRIMARY KEY (id_guest),
  CONSTRAINT guest_usuario_tenant_uk UNIQUE (id_barberia, id_guest),
  CONSTRAINT guest_usuario_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia)
);
-- Un invitado por correo y barbería
CREATE UNIQUE INDEX guest_usuario_correo_uk ON public.guest_usuario (id_barberia, lower(correo));

-- Registro histórico de consentimientos (Ley 19.628 / Ley 21.719).
-- Cada aceptación o retiro es una fila nueva; nunca se edita.
CREATE TABLE public.consentimiento (
  id_consentimiento bigint      GENERATED ALWAYS AS IDENTITY,
  id_usuario        uuid,                          -- usuario registrado …
  id_guest          uuid,                          -- … o invitado
  tipo              text        NOT NULL,
  version_politica  text        NOT NULL,          -- p. ej. '2026-10'
  aceptado          boolean     NOT NULL,          -- false = retiro del consentimiento
  ip                inet,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consentimiento_pkey PRIMARY KEY (id_consentimiento),
  CONSTRAINT consentimiento_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario),
  CONSTRAINT consentimiento_id_guest_fkey   FOREIGN KEY (id_guest)   REFERENCES public.guest_usuario(id_guest),
  CONSTRAINT consentimiento_tipo_check CHECK (tipo IN ('terminos','privacidad','marketing')),
  CONSTRAINT consentimiento_un_titular CHECK (num_nonnulls(id_usuario, id_guest) = 1)
);

-- =====================================================================
-- 3. AGENDA
-- =====================================================================

-- Profesional = usuario con rol 'profesional' en una barbería.
-- PK compuesta: la misma persona puede trabajar en varias barberías.
CREATE TABLE public.profesional (
  id_barberia    uuid        NOT NULL,
  id_profesional uuid        NOT NULL,             -- = usuario.id_usuario
  alias          varchar,                          -- nombre artístico (opcional)
  especialidad   varchar,
  activo         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profesional_pkey PRIMARY KEY (id_barberia, id_profesional),
  CONSTRAINT profesional_id_barberia_fkey FOREIGN KEY (id_barberia)    REFERENCES public.barberia(id_barberia),
  CONSTRAINT profesional_usuario_fkey     FOREIGN KEY (id_profesional) REFERENCES public.usuario(id_usuario),
  CONSTRAINT profesional_membresia_fkey   FOREIGN KEY (id_barberia, id_profesional)
                                          REFERENCES public.usuario_barberia(id_barberia, id_usuario)
);

CREATE TABLE public.servicio (
  id_servicio  bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia  uuid             NOT NULL,
  nombre       varchar          NOT NULL,
  descripcion  text,
  duracion_min integer          NOT NULL DEFAULT 30,
  precio       public.monto_clp NOT NULL,
  activo       boolean          NOT NULL DEFAULT true,
  created_at   timestamptz      NOT NULL DEFAULT now(),
  updated_at   timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT servicio_pkey PRIMARY KEY (id_servicio),
  CONSTRAINT servicio_tenant_uk UNIQUE (id_barberia, id_servicio),
  CONSTRAINT servicio_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT servicio_duracion_positiva CHECK (duracion_min > 0)
);

-- Qué servicios realiza cada profesional (N:M)
CREATE TABLE public.profesional_servicio (
  id_barberia    uuid        NOT NULL,
  id_profesional uuid        NOT NULL,
  id_servicio    bigint      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profesional_servicio_pkey PRIMARY KEY (id_barberia, id_profesional, id_servicio),
  CONSTRAINT profesional_servicio_profesional_fkey FOREIGN KEY (id_barberia, id_profesional)
             REFERENCES public.profesional(id_barberia, id_profesional) ON DELETE CASCADE,
  CONSTRAINT profesional_servicio_servicio_fkey FOREIGN KEY (id_barberia, id_servicio)
             REFERENCES public.servicio(id_barberia, id_servicio) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Sucursales: URL propia y barberos asignados
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.slug_desde_texto(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(nullif(trim(BOTH '-' FROM regexp_replace(
    translate(lower(p_texto), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou'),
    '[^a-z0-9]+', '-', 'g')), ''), 'sucursal')
$$;

-- Rutas hermanas de /<barberia>/<sucursal> (app/[slug]/...)
CREATE OR REPLACE FUNCTION private.slug_sucursal_reservado(p_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_slug = ANY (ARRAY['agendar','tienda','cart','carrito','checkout','profile','dashboard',
                             'booking-confirmed','booking-cancelled','reprogramar','cita'])
$$;

-- La página de la sucursal es /<barberia>/<slug>; si no se indica se genera desde el nombre
ALTER TABLE public.sucursal ADD COLUMN slug text NOT NULL,
  ADD CONSTRAINT sucursal_slug_key UNIQUE (id_barberia, slug),
  ADD CONSTRAINT sucursal_slug_formato CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT sucursal_slug_no_reservado CHECK (NOT private.slug_sucursal_reservado(slug));

CREATE OR REPLACE FUNCTION private.asignar_slug_sucursal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_base text;
  v_slug text;
  n int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;
  v_base := left(private.slug_desde_texto(NEW.nombre), 40);
  IF private.slug_sucursal_reservado(v_base) THEN
    v_base := v_base || '-sucursal';
  END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.sucursal s
                WHERE s.id_barberia = NEW.id_barberia AND s.slug = v_slug
                  AND s.id_sucursal IS DISTINCT FROM NEW.id_sucursal) LOOP
    n := n + 1;
    v_slug := v_base || '-' || n;
  END LOOP;
  NEW.slug := v_slug;
  RETURN NEW;
END $$;

CREATE TRIGGER a_sucursal_slug
  BEFORE INSERT OR UPDATE OF slug ON public.sucursal
  FOR EACH ROW EXECUTE FUNCTION private.asignar_slug_sucursal();

-- Sucursales donde atiende cada barbero (puede ser más de una)
CREATE TABLE public.profesional_sucursal (
  id_barberia    uuid        NOT NULL,
  id_profesional uuid        NOT NULL,
  id_sucursal    bigint      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profesional_sucursal_pkey PRIMARY KEY (id_barberia, id_profesional, id_sucursal),
  CONSTRAINT profesional_sucursal_profesional_fkey FOREIGN KEY (id_barberia, id_profesional)
             REFERENCES public.profesional(id_barberia, id_profesional) ON DELETE CASCADE,
  CONSTRAINT profesional_sucursal_sucursal_fkey FOREIGN KEY (id_barberia, id_sucursal)
             REFERENCES public.sucursal(id_barberia, id_sucursal) ON DELETE CASCADE
);
CREATE INDEX profesional_sucursal_sucursal_idx ON public.profesional_sucursal (id_barberia, id_sucursal);

-- Al quitar a un barbero de una sucursal se desactivan sus horarios ahí
CREATE OR REPLACE FUNCTION private.desactivar_horarios_sucursal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.horario_atencion SET activo = false
  WHERE id_barberia = OLD.id_barberia AND id_profesional = OLD.id_profesional
    AND id_sucursal = OLD.id_sucursal AND activo;
  RETURN NULL;
END $$;

CREATE TRIGGER profesional_sucursal_quitar
  AFTER DELETE ON public.profesional_sucursal
  FOR EACH ROW EXECUTE FUNCTION private.desactivar_horarios_sucursal();

-- Horario semanal de atención de un profesional en una sucursal
-- (dia_semana: 0 = domingo … 6 = sábado; horas locales de la sucursal)
CREATE TABLE public.horario_atencion (
  id_horario     bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia    uuid        NOT NULL,
  id_profesional uuid        NOT NULL,
  id_sucursal    bigint      NOT NULL,
  dia_semana     integer     NOT NULL,
  hora_inicio    time        NOT NULL,
  hora_fin       time        NOT NULL,
  activo         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT horario_atencion_pkey PRIMARY KEY (id_horario),
  CONSTRAINT horario_atencion_profesional_fkey FOREIGN KEY (id_barberia, id_profesional)
             REFERENCES public.profesional(id_barberia, id_profesional) ON DELETE CASCADE,
  CONSTRAINT horario_atencion_sucursal_fkey FOREIGN KEY (id_barberia, id_sucursal)
             REFERENCES public.sucursal(id_barberia, id_sucursal),
  CONSTRAINT horario_atencion_dia_semana_check CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT horario_atencion_rango CHECK (hora_fin > hora_inicio),
  -- La misma persona no puede tener dos tramos solapados el mismo día,
  -- aunque sean en sucursales o barberías distintas
  CONSTRAINT horario_atencion_sin_solape EXCLUDE USING gist (
    id_profesional WITH =,
    dia_semana     WITH =,
    tsrange(DATE '2000-01-01' + hora_inicio, DATE '2000-01-01' + hora_fin) WITH &&
  ) WHERE (activo)
);

-- Días en que un profesional no atiende (vacaciones, licencia, etc.)
CREATE TABLE public.dia_bloqueado (
  id_dia_bloqueado bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia      uuid        NOT NULL,
  id_profesional   uuid        NOT NULL,
  fecha            date        NOT NULL,
  motivo           text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dia_bloqueado_pkey PRIMARY KEY (id_dia_bloqueado),
  CONSTRAINT dia_bloqueado_unico UNIQUE (id_barberia, id_profesional, fecha),
  CONSTRAINT dia_bloqueado_profesional_fkey FOREIGN KEY (id_barberia, id_profesional)
             REFERENCES public.profesional(id_barberia, id_profesional) ON DELETE CASCADE
);

CREATE TABLE public.reserva (
  id_reserva        bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia       uuid             NOT NULL,
  id_sucursal       bigint           NOT NULL,
  id_cliente        uuid,                          -- cliente registrado …
  id_guest          uuid,                          -- … o cliente invitado
  id_profesional    uuid             NOT NULL,
  id_servicio       bigint           NOT NULL,
  fecha_hora_inicio timestamptz      NOT NULL,
  fecha_hora_fin    timestamptz      NOT NULL,     -- lo calcula el trigger según la duración
  estado            text             NOT NULL DEFAULT 'pendiente',
  monto             public.monto_clp NOT NULL,     -- precio del servicio al reservar (lo asigna el trigger)
  notas             text,
  recordatorio_enviado_at timestamptz,             -- correo de recordatorio (24 h antes) ya enviado
  created_at        timestamptz      NOT NULL DEFAULT now(),
  updated_at        timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT reserva_pkey PRIMARY KEY (id_reserva),
  CONSTRAINT reserva_tenant_uk UNIQUE (id_barberia, id_reserva),
  CONSTRAINT reserva_sucursal_fkey    FOREIGN KEY (id_barberia, id_sucursal)
             REFERENCES public.sucursal(id_barberia, id_sucursal),
  CONSTRAINT reserva_cliente_fkey     FOREIGN KEY (id_cliente)  REFERENCES public.usuario(id_usuario),
  CONSTRAINT reserva_guest_fkey       FOREIGN KEY (id_barberia, id_guest)
             REFERENCES public.guest_usuario(id_barberia, id_guest),
  CONSTRAINT reserva_profesional_fkey FOREIGN KEY (id_barberia, id_profesional)
             REFERENCES public.profesional(id_barberia, id_profesional),
  CONSTRAINT reserva_servicio_fkey    FOREIGN KEY (id_barberia, id_servicio)
             REFERENCES public.servicio(id_barberia, id_servicio),
  CONSTRAINT reserva_estado_check CHECK (estado IN ('pendiente','confirmada','completada','cancelada','no_asistio')),
  CONSTRAINT reserva_rango      CHECK (fecha_hora_fin > fecha_hora_inicio),
  CONSTRAINT reserva_un_cliente CHECK (num_nonnulls(id_cliente, id_guest) = 1),
  -- Una persona no puede tener dos reservas solapadas (en ninguna barbería)
  CONSTRAINT reserva_sin_solape EXCLUDE USING gist (
    id_profesional WITH =,
    tstzrange(fecha_hora_inicio, fecha_hora_fin) WITH &&
  ) WHERE (estado <> 'cancelada')
);

-- Historial de cambios de estado (auditoría y KPI de inasistencias)
CREATE TABLE public.reserva_historial (
  id_historial    bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia     uuid        NOT NULL,
  id_reserva      bigint      NOT NULL,
  estado_anterior text,                            -- NULL al crear la reserva
  estado_nuevo    text        NOT NULL,
  cambiado_por    uuid,                            -- usuario autenticado (NULL = sistema)
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_historial_pkey PRIMARY KEY (id_historial),
  CONSTRAINT reserva_historial_reserva_fkey FOREIGN KEY (id_barberia, id_reserva)
             REFERENCES public.reserva(id_barberia, id_reserva) ON DELETE CASCADE,
  CONSTRAINT reserva_historial_cambiado_por_fkey FOREIGN KEY (cambiado_por) REFERENCES public.usuario(id_usuario)
);

-- =====================================================================
-- 4. COMERCIO
-- =====================================================================

CREATE TABLE public.producto (
  id_producto  bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia  uuid             NOT NULL,
  nombre       text             NOT NULL,
  descripcion  text,
  categoria    text             NOT NULL,
  precio       public.monto_clp NOT NULL,
  stock        integer          NOT NULL DEFAULT 0,
  stock_minimo integer          NOT NULL DEFAULT 0,   -- umbral de alerta de reposición
  imagen_url   text,
  tag          text,
  activo       boolean          NOT NULL DEFAULT true,
  alerta_stock_at timestamptz,                         -- correo de stock bajo ya enviado (se limpia al reponer)
  created_at   timestamptz      NOT NULL DEFAULT now(),
  updated_at   timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT producto_pkey PRIMARY KEY (id_producto),
  CONSTRAINT producto_tenant_uk UNIQUE (id_barberia, id_producto),
  CONSTRAINT producto_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT producto_stock_no_negativo CHECK (stock >= 0),
  CONSTRAINT producto_stock_minimo_check CHECK (stock_minimo >= 0)
);

CREATE TABLE public.pedido (
  id_pedido       bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia     uuid             NOT NULL,
  id_sucursal     bigint,                          -- sucursal de retiro / venta presencial
  id_cliente      uuid,                            -- NULL = venta presencial sin cuenta
  estado          text             NOT NULL DEFAULT 'pendiente',
  estado_pago     text             NOT NULL DEFAULT 'pendiente',   -- lo actualiza la tabla pago
  monto_total     public.monto_clp NOT NULL DEFAULT 0,             -- suma de detalle_pedido (trigger)
  tipo_entrega    text             NOT NULL DEFAULT 'retiro',
  direccion_envio text,                            -- copia de la dirección al comprar
  stock_descontado boolean         NOT NULL DEFAULT false,         -- lo maneja pedido_antes_de_guardar
  created_at      timestamptz      NOT NULL DEFAULT now(),
  updated_at      timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT pedido_pkey PRIMARY KEY (id_pedido),
  CONSTRAINT pedido_tenant_uk UNIQUE (id_barberia, id_pedido),
  CONSTRAINT pedido_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT pedido_sucursal_fkey    FOREIGN KEY (id_barberia, id_sucursal)
             REFERENCES public.sucursal(id_barberia, id_sucursal),
  CONSTRAINT pedido_cliente_fkey     FOREIGN KEY (id_cliente)  REFERENCES public.usuario(id_usuario),
  CONSTRAINT pedido_estado_check CHECK (estado IN
             ('pendiente','confirmado','preparando','listo_retiro','enviado','entregado','cancelado')),
  CONSTRAINT pedido_estado_pago_check CHECK (estado_pago IN ('pendiente','pagado','rechazado','reembolsado')),
  CONSTRAINT pedido_tipo_entrega_check CHECK (tipo_entrega IN ('retiro','despacho')),
  CONSTRAINT pedido_despacho_con_direccion CHECK (tipo_entrega <> 'despacho' OR direccion_envio IS NOT NULL)
);

CREATE TABLE public.detalle_pedido (
  id_detalle      bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia     uuid             NOT NULL,
  id_pedido       bigint           NOT NULL,
  id_producto     bigint           NOT NULL,
  cantidad        integer          NOT NULL,
  precio_unitario public.monto_clp NOT NULL,      -- precio del producto al comprar (lo asigna el trigger)
  subtotal        numeric(12,0)    GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  CONSTRAINT detalle_pedido_pkey PRIMARY KEY (id_detalle),
  CONSTRAINT detalle_pedido_producto_unico UNIQUE (id_pedido, id_producto),
  CONSTRAINT detalle_pedido_pedido_fkey   FOREIGN KEY (id_barberia, id_pedido)
             REFERENCES public.pedido(id_barberia, id_pedido) ON DELETE CASCADE,
  CONSTRAINT detalle_pedido_producto_fkey FOREIGN KEY (id_barberia, id_producto)
             REFERENCES public.producto(id_barberia, id_producto),
  CONSTRAINT detalle_pedido_cantidad_positiva CHECK (cantidad > 0)
);

-- =====================================================================
-- 5. PAGOS
-- =====================================================================

-- Cada intento de pago, aprobación, rechazo o reembolso informado por la
-- pasarela (Webpay, Mercado Pago, Flow) o registrado en caja.
-- Solo lo escribe el backend (service_role) al recibir el webhook.
CREATE TABLE public.pago (
  id_pago                bigint           GENERATED ALWAYS AS IDENTITY,
  id_barberia            uuid             NOT NULL,
  concepto               text             NOT NULL,
  id_pedido              bigint,
  id_reserva             bigint,
  id_suscripcion         bigint,
  id_suscripcion_modulo  bigint,
  monto                  public.monto_clp NOT NULL,
  proveedor              text             NOT NULL,
  id_transaccion_externa text,                     -- id de la pasarela (idempotencia de webhooks)
  estado                 text             NOT NULL DEFAULT 'pendiente',
  detalle                jsonb,                    -- respuesta cruda de la pasarela
  created_at             timestamptz      NOT NULL DEFAULT now(),
  updated_at             timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT pago_pkey PRIMARY KEY (id_pago),
  CONSTRAINT pago_transaccion_unica UNIQUE (proveedor, id_transaccion_externa),
  CONSTRAINT pago_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT pago_pedido_fkey      FOREIGN KEY (id_barberia, id_pedido)
             REFERENCES public.pedido(id_barberia, id_pedido),
  CONSTRAINT pago_reserva_fkey     FOREIGN KEY (id_barberia, id_reserva)
             REFERENCES public.reserva(id_barberia, id_reserva),
  CONSTRAINT pago_suscripcion_fkey FOREIGN KEY (id_barberia, id_suscripcion)
             REFERENCES public.suscripcion(id_barberia, id_suscripcion),
  CONSTRAINT pago_suscripcion_modulo_fkey FOREIGN KEY (id_barberia, id_suscripcion_modulo)
             REFERENCES public.suscripcion_modulo(id_barberia, id_suscripcion_modulo),
  CONSTRAINT pago_concepto_check  CHECK (concepto IN ('pedido','reserva','suscripcion','modulo')),
  CONSTRAINT pago_proveedor_check CHECK (proveedor IN ('webpay','mercadopago','flow','efectivo','transferencia')),
  CONSTRAINT pago_estado_check    CHECK (estado IN ('pendiente','aprobado','rechazado','anulado','reembolsado')),
  -- Exactamente la referencia que corresponde al concepto
  CONSTRAINT pago_referencia_coherente CHECK (
        (concepto = 'pedido')      = (id_pedido IS NOT NULL)
    AND (concepto = 'reserva')     = (id_reserva IS NOT NULL)
    AND (concepto = 'suscripcion') = (id_suscripcion IS NOT NULL)
    AND (concepto = 'modulo')      = (id_suscripcion_modulo IS NOT NULL))
);

-- =====================================================================
-- 6. OPINIONES Y BI
-- =====================================================================

CREATE TABLE public.resena (
  id_resena      bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia    uuid        NOT NULL,
  id_cliente     uuid,                             -- autor registrado …
  id_guest       uuid,                             -- … o autor invitado
  id_reserva     bigint,
  id_profesional uuid,
  id_servicio    bigint,
  id_producto    bigint,
  calificacion   smallint    NOT NULL,
  comentario     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resena_pkey PRIMARY KEY (id_resena),
  CONSTRAINT resena_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT resena_cliente_fkey     FOREIGN KEY (id_cliente)  REFERENCES public.usuario(id_usuario),
  CONSTRAINT resena_guest_fkey       FOREIGN KEY (id_barberia, id_guest)
             REFERENCES public.guest_usuario(id_barberia, id_guest),
  CONSTRAINT resena_reserva_fkey     FOREIGN KEY (id_barberia, id_reserva)
             REFERENCES public.reserva(id_barberia, id_reserva),
  CONSTRAINT resena_profesional_fkey FOREIGN KEY (id_barberia, id_profesional)
             REFERENCES public.profesional(id_barberia, id_profesional),
  CONSTRAINT resena_servicio_fkey    FOREIGN KEY (id_barberia, id_servicio)
             REFERENCES public.servicio(id_barberia, id_servicio),
  CONSTRAINT resena_producto_fkey    FOREIGN KEY (id_barberia, id_producto)
             REFERENCES public.producto(id_barberia, id_producto),
  CONSTRAINT resena_calificacion_rango CHECK (calificacion BETWEEN 1 AND 5),
  CONSTRAINT resena_un_autor     CHECK (num_nonnulls(id_cliente, id_guest) = 1),
  CONSTRAINT resena_tiene_objeto CHECK (num_nonnulls(id_reserva, id_servicio, id_profesional, id_producto) >= 1)
);
CREATE UNIQUE INDEX resena_una_por_reserva ON public.resena (id_reserva) WHERE id_reserva IS NOT NULL;

CREATE TABLE public.prediccion_demanda (
  id_prediccion  bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia    uuid        NOT NULL,
  id_producto    bigint,                           -- solo cuando tipo = 'producto'
  tipo           text        NOT NULL,
  fecha_objetivo date        NOT NULL,
  valor_estimado numeric     NOT NULL,
  modelo         text        NOT NULL,             -- p. ej. 'prophet', 'arima'
  mape           numeric,                          -- error porcentual del modelo
  valor_min      numeric,                          -- margen de error (HU-25)
  valor_max      numeric,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediccion_demanda_pkey PRIMARY KEY (id_prediccion),
  CONSTRAINT prediccion_demanda_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT prediccion_demanda_producto_fkey FOREIGN KEY (id_barberia, id_producto)
             REFERENCES public.producto(id_barberia, id_producto),
  CONSTRAINT prediccion_demanda_tipo_check CHECK (tipo IN ('producto','reservas','ingresos')),
  CONSTRAINT prediccion_demanda_mape_check CHECK (mape >= 0),
  CONSTRAINT prediccion_producto_coherente CHECK ((tipo = 'producto') = (id_producto IS NOT NULL)),
  CONSTRAINT prediccion_demanda_rango_check CHECK (valor_min <= valor_estimado AND valor_estimado <= valor_max)
);

-- =====================================================================
-- 7. ÍNDICES (llaves foráneas y consultas frecuentes)
-- =====================================================================

-- Plataforma
CREATE INDEX suscripcion_id_plan_idx            ON public.suscripcion (id_plan);
CREATE INDEX suscripcion_modulo_id_modulo_idx   ON public.suscripcion_modulo (id_modulo);
CREATE INDEX plan_modulo_id_modulo_idx          ON public.plan_modulo (id_modulo);
CREATE INDEX plan_limite_id_tipo_limite_idx     ON public.plan_limite (id_tipo_limite);
CREATE INDEX tipo_limite_id_modulo_idx          ON public.tipo_limite (id_modulo);
-- Usuarios
CREATE INDEX usuario_barberia_usuario_idx       ON public.usuario_barberia (id_usuario);
CREATE INDEX direccion_usuario_usuario_idx      ON public.direccion_usuario (id_usuario);
CREATE INDEX consentimiento_usuario_idx         ON public.consentimiento (id_usuario, tipo, created_at DESC);
CREATE INDEX consentimiento_guest_idx           ON public.consentimiento (id_guest);
-- Agenda
CREATE INDEX profesional_usuario_idx            ON public.profesional (id_profesional);
CREATE INDEX profesional_servicio_servicio_idx  ON public.profesional_servicio (id_barberia, id_servicio);
CREATE INDEX horario_profesional_idx            ON public.horario_atencion (id_barberia, id_profesional, dia_semana);
CREATE INDEX horario_sucursal_idx               ON public.horario_atencion (id_barberia, id_sucursal);
CREATE INDEX reserva_agenda_idx                 ON public.reserva (id_barberia, id_profesional, fecha_hora_inicio);
CREATE INDEX reserva_sucursal_idx               ON public.reserva (id_barberia, id_sucursal, fecha_hora_inicio);
CREATE INDEX reserva_servicio_idx               ON public.reserva (id_barberia, id_servicio);
CREATE INDEX reserva_cliente_idx                ON public.reserva (id_cliente) WHERE id_cliente IS NOT NULL;
CREATE INDEX reserva_guest_idx                  ON public.reserva (id_barberia, id_guest) WHERE id_guest IS NOT NULL;
CREATE INDEX reserva_historial_reserva_idx      ON public.reserva_historial (id_barberia, id_reserva);
CREATE INDEX reserva_historial_usuario_idx      ON public.reserva_historial (cambiado_por);
-- Comercio
CREATE INDEX pedido_fecha_idx                   ON public.pedido (id_barberia, created_at);
CREATE INDEX pedido_cliente_idx                 ON public.pedido (id_cliente);
CREATE INDEX pedido_sucursal_idx                ON public.pedido (id_barberia, id_sucursal);
CREATE INDEX detalle_pedido_idx                 ON public.detalle_pedido (id_barberia, id_pedido);
CREATE INDEX detalle_pedido_producto_idx        ON public.detalle_pedido (id_barberia, id_producto);
-- Pagos
CREATE INDEX pago_pedido_idx                    ON public.pago (id_barberia, id_pedido)      WHERE id_pedido IS NOT NULL;
CREATE INDEX pago_reserva_idx                   ON public.pago (id_barberia, id_reserva)     WHERE id_reserva IS NOT NULL;
CREATE INDEX pago_suscripcion_idx               ON public.pago (id_barberia, id_suscripcion) WHERE id_suscripcion IS NOT NULL;
CREATE INDEX pago_suscripcion_modulo_idx        ON public.pago (id_barberia, id_suscripcion_modulo) WHERE id_suscripcion_modulo IS NOT NULL;
-- Opiniones y BI
CREATE INDEX resena_barberia_idx                ON public.resena (id_barberia);
CREATE INDEX resena_cliente_idx                 ON public.resena (id_cliente);
CREATE INDEX resena_guest_idx                   ON public.resena (id_barberia, id_guest);
CREATE INDEX resena_reserva_idx                 ON public.resena (id_barberia, id_reserva);
CREATE INDEX resena_profesional_idx             ON public.resena (id_barberia, id_profesional);
CREATE INDEX resena_servicio_idx                ON public.resena (id_barberia, id_servicio);
CREATE INDEX resena_producto_idx                ON public.resena (id_barberia, id_producto);
CREATE INDEX prediccion_idx                     ON public.prediccion_demanda (id_barberia, tipo, fecha_objetivo);
CREATE INDEX prediccion_producto_idx            ON public.prediccion_demanda (id_barberia, id_producto);
CREATE UNIQUE INDEX prediccion_unica            ON public.prediccion_demanda (id_barberia, tipo, fecha_objetivo)
  WHERE tipo <> 'producto';

-- =====================================================================
-- 8. REGLAS DE SUSCRIPCIÓN (módulos y límites)
--    La app y las políticas consultan estas funciones en vez de columnas
--    fijas: un módulo o límite nuevo no requiere código SQL nuevo.
-- =====================================================================

-- Módulos habilitados hoy para cada barbería = base + plan + adicionales
CREATE VIEW public.v_barberia_modulo WITH (security_invoker = true) AS
SELECT s.id_barberia, m.id_modulo, m.codigo, 'base'::text AS origen
FROM public.suscripcion s
JOIN public.modulo m ON m.es_base AND m.activo
WHERE s.estado IN ('prueba','activa')
  AND (s.fecha_termino IS NULL OR s.fecha_termino >= public.hoy_chile())
UNION
SELECT s.id_barberia, m.id_modulo, m.codigo, 'plan'
FROM public.suscripcion s
JOIN public.plan_modulo pm ON pm.id_plan = s.id_plan
JOIN public.modulo m       ON m.id_modulo = pm.id_modulo AND m.activo
WHERE s.estado IN ('prueba','activa')
  AND (s.fecha_termino IS NULL OR s.fecha_termino >= public.hoy_chile())
UNION
SELECT sm.id_barberia, m.id_modulo, m.codigo, 'adicional'
FROM public.suscripcion_modulo sm
JOIN public.modulo m ON m.id_modulo = sm.id_modulo AND m.activo
WHERE sm.estado = 'activo'
  AND (sm.fecha_termino IS NULL OR sm.fecha_termino >= public.hoy_chile());

-- ¿La barbería tiene habilitado el módulo?
CREATE FUNCTION public.barberia_tiene_modulo(p_barberia uuid, p_codigo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.v_barberia_modulo
    WHERE id_barberia = p_barberia AND codigo = p_codigo
  );
$$;

-- Límite vigente: NULL = ilimitado; 0 si no tiene suscripción vigente
CREATE FUNCTION public.barberia_limite(p_barberia uuid, p_codigo text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN s.id_plan IS NULL THEN 0 ELSE pl.valor END
  FROM (SELECT 1) AS x
  LEFT JOIN public.suscripcion s
         ON s.id_barberia = p_barberia AND s.estado IN ('prueba','activa')
        AND (s.fecha_termino IS NULL OR s.fecha_termino >= public.hoy_chile())
  LEFT JOIN public.tipo_limite tl ON tl.codigo = p_codigo
  LEFT JOIN public.plan_limite pl
         ON pl.id_plan = s.id_plan AND pl.id_tipo_limite = tl.id_tipo_limite;
$$;

-- Trigger genérico: impide crear registros de un módulo no contratado.
-- Uso: EXECUTE FUNCTION validar_modulo_contratado('<codigo_modulo>')
CREATE FUNCTION public.validar_modulo_contratado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.barberia_tiene_modulo(NEW.id_barberia, TG_ARGV[0]) THEN
    RAISE EXCEPTION 'La barbería no tiene contratado el módulo "%"', TG_ARGV[0]
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- Trigger genérico: impide superar un límite del plan contando filas activas.
-- Uso: EXECUTE FUNCTION validar_limite_plan('<codigo_limite>' [, '<columna_activo>'])
CREATE FUNCTION public.validar_limite_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_col    text := coalesce(TG_ARGV[1], 'activo');
  v_max    integer;
  v_actual integer;
BEGIN
  IF NOT (to_jsonb(NEW) ->> v_col)::boolean THEN
    RETURN NEW;
  END IF;
  -- Serializa altas concurrentes en la misma barbería y tabla
  PERFORM pg_advisory_xact_lock(hashtext(NEW.id_barberia::text || TG_TABLE_NAME));
  v_max := public.barberia_limite(NEW.id_barberia, TG_ARGV[0]);
  IF v_max IS NULL THEN
    RETURN NEW;                                    -- ilimitado
  END IF;
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE id_barberia = $1 AND %I',
                 TG_TABLE_SCHEMA, TG_TABLE_NAME, v_col)
     INTO v_actual USING NEW.id_barberia;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) ->> v_col)::boolean
     AND OLD.id_barberia = NEW.id_barberia THEN
    v_actual := v_actual - 1;                      -- la fila ya estaba contada
  END IF;
  IF v_actual >= v_max THEN
    RAISE EXCEPTION 'El plan de la barbería permite como máximo % (%)', v_max, TG_ARGV[0]
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- Límites
CREATE TRIGGER sucursal_limite_plan
  BEFORE INSERT OR UPDATE OF activa, id_barberia ON public.sucursal
  FOR EACH ROW EXECUTE FUNCTION public.validar_limite_plan('max_sucursales', 'activa');
CREATE TRIGGER profesional_limite_plan
  BEFORE INSERT OR UPDATE OF activo, id_barberia ON public.profesional
  FOR EACH ROW EXECUTE FUNCTION public.validar_limite_plan('max_profesionales');
CREATE TRIGGER producto_limite_plan
  BEFORE INSERT OR UPDATE OF activo, id_barberia ON public.producto
  FOR EACH ROW EXECUTE FUNCTION public.validar_limite_plan('max_productos');

-- CP-50: un módulo sin precio_addon (p. ej. 'bi') solo llega por el plan, nunca como adicional
CREATE FUNCTION public.validar_modulo_adicional() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.estado = 'activo' AND NOT EXISTS (
    SELECT 1 FROM public.modulo WHERE id_modulo = NEW.id_modulo AND precio_addon IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Este módulo no se vende por separado' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validar_modulo_adicional() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER suscripcion_modulo_vendible
  BEFORE INSERT OR UPDATE OF estado, id_modulo ON public.suscripcion_modulo
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_adicional();

-- Módulos requeridos
CREATE TRIGGER producto_requiere_ecommerce
  BEFORE INSERT ON public.producto
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('ecommerce');
CREATE TRIGGER pedido_requiere_ecommerce
  BEFORE INSERT ON public.pedido
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('ecommerce');
CREATE TRIGGER prediccion_requiere_pronostico
  BEFORE INSERT ON public.prediccion_demanda
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('pronostico');

-- =====================================================================
-- 9. REGLAS DE NEGOCIO
--    Las funciones son SECURITY DEFINER porque deben leer o actualizar
--    tablas que el usuario que dispara la acción no ve por RLS
--    (p. ej. un cliente que compra descuenta stock de producto).
-- =====================================================================

-- 9.1 Un cliente que reserva o compra pasa a ser cliente de esa barbería
CREATE FUNCTION public.asegurar_membresia_cliente(p_barberia uuid, p_usuario uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.usuario_barberia (id_usuario, id_barberia, rol)
  VALUES (p_usuario, p_barberia, 'cliente')
  ON CONFLICT (id_barberia, id_usuario) DO NOTHING;
$$;

-- 9.2 Reserva: valida disponibilidad real y calcula fin y monto
CREATE FUNCTION public.validar_reserva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_duracion integer;
  v_precio   numeric;
  v_activo   boolean;
  v_tz       text;
  v_ini      timestamp;   -- hora local de la sucursal
  v_fin      timestamp;
BEGIN
  -- Servicio activo de la barbería
  SELECT s.duracion_min, s.precio, s.activo INTO v_duracion, v_precio, v_activo
  FROM public.servicio s
  WHERE s.id_barberia = NEW.id_barberia AND s.id_servicio = NEW.id_servicio;
  IF NOT FOUND OR NOT v_activo THEN
    RAISE EXCEPTION 'El servicio no existe o no está activo' USING ERRCODE = 'check_violation';
  END IF;

  -- El fin siempre se deriva de la duración; el monto, del precio vigente
  NEW.fecha_hora_fin := NEW.fecha_hora_inicio + make_interval(mins => v_duracion);
  IF TG_OP = 'INSERT' OR NEW.id_servicio IS DISTINCT FROM OLD.id_servicio THEN
    NEW.monto := v_precio;
  END IF;

  -- Profesional activo y que realiza el servicio
  IF NOT EXISTS (SELECT 1 FROM public.profesional p
                 WHERE p.id_barberia = NEW.id_barberia
                   AND p.id_profesional = NEW.id_profesional AND p.activo) THEN
    RAISE EXCEPTION 'El profesional no está activo en esta barbería' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profesional_servicio ps
                 WHERE ps.id_barberia = NEW.id_barberia
                   AND ps.id_profesional = NEW.id_profesional
                   AND ps.id_servicio = NEW.id_servicio) THEN
    RAISE EXCEPTION 'El profesional no realiza este servicio' USING ERRCODE = 'check_violation';
  END IF;

  -- Hora local según la zona horaria de la sucursal
  SELECT su.zona_horaria INTO v_tz
  FROM public.sucursal su
  WHERE su.id_barberia = NEW.id_barberia AND su.id_sucursal = NEW.id_sucursal AND su.activa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La sucursal no existe o no está activa' USING ERRCODE = 'check_violation';
  END IF;
  v_ini := NEW.fecha_hora_inicio AT TIME ZONE v_tz;
  v_fin := NEW.fecha_hora_fin    AT TIME ZONE v_tz;

  -- Dentro de un tramo del horario del profesional en esa sucursal
  IF v_ini::date <> (v_fin - interval '1 microsecond')::date OR NOT EXISTS (
       SELECT 1 FROM public.horario_atencion h
       WHERE h.id_barberia    = NEW.id_barberia
         AND h.id_profesional = NEW.id_profesional
         AND h.id_sucursal    = NEW.id_sucursal
         AND h.activo
         AND h.dia_semana  = extract(dow FROM v_ini)::int
         AND h.hora_inicio <= v_ini::time
         AND h.hora_fin    >= v_fin::time) THEN
    RAISE EXCEPTION 'La reserva está fuera del horario de atención del profesional'
      USING ERRCODE = 'check_violation';
  END IF;

  -- No en un día bloqueado
  IF EXISTS (SELECT 1 FROM public.dia_bloqueado d
             WHERE d.id_barberia = NEW.id_barberia
               AND d.id_profesional = NEW.id_profesional
               AND d.fecha = v_ini::date) THEN
    RAISE EXCEPTION 'El profesional no atiende ese día' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.id_cliente IS NOT NULL THEN
    PERFORM public.asegurar_membresia_cliente(NEW.id_barberia, NEW.id_cliente);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reserva_validar
  BEFORE INSERT OR UPDATE OF fecha_hora_inicio, id_profesional, id_servicio, id_sucursal
  ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION public.validar_reserva();

-- 9.3 Historial de estados de reserva
CREATE FUNCTION public.registrar_historial_reserva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.reserva_historial (id_barberia, id_reserva, estado_anterior, estado_nuevo, cambiado_por)
    VALUES (NEW.id_barberia, NEW.id_reserva,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END,
            NEW.estado, auth.uid());
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER reserva_historial_estado
  AFTER INSERT OR UPDATE OF estado ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_reserva();

-- 9.4 Pedido: total y estado de pago solo los calcula la base de datos
CREATE FUNCTION public.pedido_antes_de_guardar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.monto_total := 0;                           -- se suma al agregar detalles
    NEW.estado_pago := 'pendiente';                 -- lo actualiza la tabla pago
    NEW.stock_descontado := false;
    IF NEW.id_cliente IS NOT NULL THEN
      PERFORM public.asegurar_membresia_cliente(NEW.id_barberia, NEW.id_cliente);
    END IF;
    RETURN NEW;
  END IF;

  -- Cambios directos (no hechos por otro trigger) no pueden tocar estos campos
  IF pg_trigger_depth() = 1 THEN
    NEW.monto_total := OLD.monto_total;
    NEW.estado_pago := OLD.estado_pago;
  END IF;
  NEW.stock_descontado := OLD.stock_descontado;
  IF OLD.estado = 'cancelado' AND NEW.estado <> 'cancelado' THEN
    RAISE EXCEPTION 'Un pedido cancelado no se puede reactivar' USING ERRCODE = 'check_violation';
  END IF;

  -- HU-23: el stock se descuenta al quedar pagado y se devuelve al cancelar (solo si se descontó)
  IF NEW.estado_pago = 'pagado' AND NEW.estado <> 'cancelado' AND NOT NEW.stock_descontado THEN
    -- Si dos compras pagan la última unidad, el stock queda en 0 (nunca negativo): el pago no se pierde
    UPDATE public.producto pr SET stock = greatest(pr.stock - d.cantidad, 0)
    FROM public.detalle_pedido d
    WHERE d.id_barberia = NEW.id_barberia AND d.id_pedido = NEW.id_pedido
      AND pr.id_barberia = d.id_barberia AND pr.id_producto = d.id_producto;
    NEW.stock_descontado := true;
  ELSIF NEW.estado = 'cancelado' AND NEW.stock_descontado THEN
    UPDATE public.producto pr SET stock = pr.stock + d.cantidad
    FROM public.detalle_pedido d
    WHERE d.id_barberia = NEW.id_barberia AND d.id_pedido = NEW.id_pedido
      AND pr.id_barberia = d.id_barberia AND pr.id_producto = d.id_producto;
    NEW.stock_descontado := false;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pedido_antes_de_guardar
  BEFORE INSERT OR UPDATE ON public.pedido
  FOR EACH ROW EXECUTE FUNCTION public.pedido_antes_de_guardar();

-- Recalcula el total del pedido
CREATE FUNCTION public.recalcular_total_pedido(p_barberia uuid, p_pedido bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.pedido p
  SET monto_total = coalesce((SELECT sum(d.subtotal) FROM public.detalle_pedido d
                              WHERE d.id_barberia = p_barberia AND d.id_pedido = p_pedido), 0)
  WHERE p.id_barberia = p_barberia AND p.id_pedido = p_pedido;
$$;

-- 9.5 Detalle de pedido: precio vigente y validación de stock (se descuenta al pagar, 9.4)
CREATE FUNCTION public.detalle_pedido_antes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_estado text;
  v_precio numeric;
  v_activo boolean;
  v_stock  integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'El detalle de un pedido no se modifica: elimínelo y agréguelo de nuevo'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT p.estado INTO v_estado FROM public.pedido p
  WHERE p.id_barberia = coalesce(NEW.id_barberia, OLD.id_barberia)
    AND p.id_pedido   = coalesce(NEW.id_pedido,   OLD.id_pedido);

  IF TG_OP = 'INSERT' THEN
    IF v_estado IS DISTINCT FROM 'pendiente' THEN
      RAISE EXCEPTION 'Solo se pueden agregar productos a un pedido pendiente' USING ERRCODE = 'check_violation';
    END IF;
    SELECT pr.precio, pr.activo, pr.stock INTO v_precio, v_activo, v_stock
    FROM public.producto pr
    WHERE pr.id_barberia = NEW.id_barberia AND pr.id_producto = NEW.id_producto;
    IF NOT FOUND OR NOT v_activo THEN
      RAISE EXCEPTION 'El producto no está disponible' USING ERRCODE = 'check_violation';
    END IF;
    IF v_stock < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.id_producto USING ERRCODE = 'check_violation';
    END IF;
    NEW.precio_unitario := v_precio;              -- el cliente no fija el precio
    RETURN NEW;
  END IF;

  -- DELETE: solo en pedidos pendientes (o en cascada al borrar el pedido)
  IF v_estado IS NOT NULL AND v_estado NOT IN ('pendiente','cancelado') THEN
    RAISE EXCEPTION 'Solo se pueden quitar productos de un pedido pendiente' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER detalle_pedido_antes
  BEFORE INSERT OR UPDATE OR DELETE ON public.detalle_pedido
  FOR EACH ROW EXECUTE FUNCTION public.detalle_pedido_antes();

CREATE FUNCTION public.detalle_pedido_despues()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.recalcular_total_pedido(coalesce(NEW.id_barberia, OLD.id_barberia),
                                         coalesce(NEW.id_pedido,   OLD.id_pedido));
  RETURN NULL;
END $$;

CREATE TRIGGER detalle_pedido_despues
  AFTER INSERT OR DELETE ON public.detalle_pedido
  FOR EACH ROW EXECUTE FUNCTION public.detalle_pedido_despues();

-- 9.6 Movimientos de stock (HU-08): todo cambio de producto.stock queda registrado
CREATE TABLE public.movimiento_stock (
  id_movimiento    bigint      GENERATED ALWAYS AS IDENTITY,
  id_barberia      uuid        NOT NULL,
  id_producto      bigint      NOT NULL,
  tipo             text        NOT NULL,
  cantidad         integer     NOT NULL,            -- con signo
  stock_resultante integer     NOT NULL,
  id_usuario       uuid,                            -- NULL = sistema (pago por webhook)
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimiento_stock_pkey PRIMARY KEY (id_movimiento),
  CONSTRAINT movimiento_stock_producto_fkey FOREIGN KEY (id_barberia, id_producto)
             REFERENCES public.producto(id_barberia, id_producto) ON DELETE CASCADE,
  CONSTRAINT movimiento_stock_tipo_check CHECK (tipo IN ('ingreso','ajuste','venta','devolucion')),
  CONSTRAINT movimiento_stock_cantidad_check CHECK (cantidad <> 0)
);
CREATE INDEX movimiento_stock_producto_idx ON public.movimiento_stock (id_barberia, id_producto, created_at DESC);

CREATE FUNCTION public.registrar_movimiento_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_delta integer := NEW.stock - CASE WHEN TG_OP = 'UPDATE' THEN OLD.stock ELSE 0 END;
BEGIN
  IF v_delta <> 0 THEN
    INSERT INTO public.movimiento_stock (id_barberia, id_producto, tipo, cantidad, stock_resultante, id_usuario)
    VALUES (NEW.id_barberia, NEW.id_producto,
            CASE WHEN pg_trigger_depth() > 1 THEN CASE WHEN v_delta < 0 THEN 'venta' ELSE 'devolucion' END  -- desde un pedido
                 WHEN v_delta > 0 THEN 'ingreso' ELSE 'ajuste' END,
            v_delta, NEW.stock, auth.uid());
  END IF;
  -- Repuesto sobre el mínimo: la próxima baja vuelve a avisar (HU-09)
  IF NEW.stock > NEW.stock_minimo AND NEW.alerta_stock_at IS NOT NULL THEN
    UPDATE public.producto SET alerta_stock_at = NULL WHERE id_producto = NEW.id_producto;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER producto_movimiento_stock
  AFTER INSERT OR UPDATE OF stock, stock_minimo ON public.producto
  FOR EACH ROW EXECUTE FUNCTION public.registrar_movimiento_stock();

-- Ingreso de stock (suma relativa: no pisa ventas simultáneas). RLS: solo el admin
CREATE FUNCTION public.ingresar_stock(p_id_producto bigint, p_cantidad integer)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.producto SET stock = stock + p_cantidad
  WHERE id_producto = p_id_producto AND p_cantidad > 0
  RETURNING stock;
$$;

-- Productos activos bajo el mínimo que aún no avisaron: los marca y los devuelve (un correo por baja)
CREATE FUNCTION public.reclamar_alertas_stock(p_barberia uuid)
RETURNS TABLE (nombre text, stock integer, stock_minimo integer)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.producto pr SET alerta_stock_at = now()
  WHERE pr.id_barberia = p_barberia AND pr.activo AND pr.stock <= pr.stock_minimo AND pr.alerta_stock_at IS NULL
  RETURNING pr.nombre, pr.stock, pr.stock_minimo;
$$;

-- 9.7 Un pago aprobado/rechazado/reembolsado actualiza el estado de pago del pedido
CREATE FUNCTION public.aplicar_pago_a_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_estado_pago text := CASE NEW.estado
                          WHEN 'aprobado'    THEN 'pagado'
                          WHEN 'reembolsado' THEN 'reembolsado'
                          WHEN 'pendiente'   THEN 'pendiente'
                          ELSE 'rechazado' END;
BEGIN
  -- Con otro intento ya aprobado, los cambios tardíos de los demás no tocan el pedido
  IF NEW.concepto = 'pedido' AND (TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado)
     AND NOT EXISTS (SELECT 1 FROM public.pago o
                     WHERE o.id_barberia = NEW.id_barberia AND o.id_pedido = NEW.id_pedido
                       AND o.estado = 'aprobado' AND o.id_pago <> NEW.id_pago) THEN
    UPDATE public.pedido p
    SET estado_pago = v_estado_pago,
        estado = CASE WHEN v_estado_pago = 'pagado' AND p.estado = 'pendiente'
                      THEN 'confirmado' ELSE p.estado END
    WHERE p.id_barberia = NEW.id_barberia AND p.id_pedido = NEW.id_pedido;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER pago_aplicar_a_pedido
  AFTER INSERT OR UPDATE OF estado ON public.pago
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_pago_a_pedido();

-- 9.8 Reseñas: solo de reservas completadas o productos recibidos
CREATE FUNCTION public.validar_resena()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_r record;
BEGIN
  IF NEW.id_reserva IS NOT NULL THEN
    SELECT r.estado, r.id_cliente, r.id_guest, r.id_profesional, r.id_servicio INTO v_r
    FROM public.reserva r
    WHERE r.id_barberia = NEW.id_barberia AND r.id_reserva = NEW.id_reserva;
    IF v_r.estado IS DISTINCT FROM 'completada' THEN
      RAISE EXCEPTION 'Solo se pueden reseñar reservas completadas' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.id_cliente IS DISTINCT FROM v_r.id_cliente OR NEW.id_guest IS DISTINCT FROM v_r.id_guest THEN
      RAISE EXCEPTION 'Solo quien asistió puede reseñar la reserva' USING ERRCODE = 'check_violation';
    END IF;
    NEW.id_profesional := coalesce(NEW.id_profesional, v_r.id_profesional);
    NEW.id_servicio    := coalesce(NEW.id_servicio,    v_r.id_servicio);
  ELSIF NEW.id_producto IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.pedido p
                   JOIN public.detalle_pedido d
                     ON d.id_barberia = p.id_barberia AND d.id_pedido = p.id_pedido
                   WHERE p.id_barberia = NEW.id_barberia
                     AND p.id_cliente  = NEW.id_cliente
                     AND p.estado      = 'entregado'
                     AND d.id_producto = NEW.id_producto) THEN
      RAISE EXCEPTION 'Solo se pueden reseñar productos comprados y entregados' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER resena_validar
  BEFORE INSERT OR UPDATE OF id_reserva, id_producto, id_cliente, id_guest ON public.resena
  FOR EACH ROW EXECUTE FUNCTION public.validar_resena();

-- 9.9 updated_at en todas las tablas que lo tienen
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
  END LOOP;
END $$;

-- =====================================================================
-- 10. VISTAS Y CONSULTAS PÚBLICAS
-- =====================================================================

-- Ficha pública de profesionales: solo nombre, foto y especialidad.
-- Es una función SECURITY DEFINER (y no una vista) porque debe leer usuario,
-- que por RLS solo ve su dueño; así expone únicamente columnas no sensibles.
CREATE FUNCTION public.profesionales_publicos(p_barberia uuid)
RETURNS TABLE (id_profesional uuid, nombre_visible text, profile_image text, especialidad varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id_profesional,
         coalesce(p.alias, trim(u.nombre || ' ' || coalesce(u.apellido, ''))),
         u.profile_image,
         p.especialidad
  FROM public.profesional p
  JOIN public.usuario  u ON u.id_usuario  = p.id_profesional AND u.deleted_at IS NULL
  JOIN public.barberia b ON b.id_barberia = p.id_barberia    AND b.activa
  WHERE p.id_barberia = p_barberia AND p.activo
  ORDER BY 2;
$$;

-- Calificaciones calculadas (reemplaza producto.rating)
CREATE VIEW public.v_calificacion_producto WITH (security_invoker = true) AS
SELECT id_barberia, id_producto,
       round(avg(calificacion), 1) AS promedio,
       count(*)                    AS cantidad
FROM public.resena
WHERE id_producto IS NOT NULL
GROUP BY id_barberia, id_producto;

CREATE VIEW public.v_calificacion_profesional WITH (security_invoker = true) AS
SELECT id_barberia, id_profesional,
       round(avg(calificacion), 1) AS promedio,
       count(*)                    AS cantidad
FROM public.resena
WHERE id_profesional IS NOT NULL
GROUP BY id_barberia, id_profesional;

-- Productos bajo el stock mínimo (alerta de reposición)
CREATE VIEW public.v_producto_bajo_stock WITH (security_invoker = true) AS
SELECT id_barberia, id_producto, nombre, stock, stock_minimo
FROM public.producto
WHERE activo AND stock <= stock_minimo;

-- Un horario activo solo puede estar en una sucursal asignada al barbero
CREATE OR REPLACE FUNCTION private.validar_horario_sucursal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.activo AND NOT EXISTS (
    SELECT 1 FROM public.profesional_sucursal ps
    WHERE ps.id_barberia = NEW.id_barberia AND ps.id_profesional = NEW.id_profesional
      AND ps.id_sucursal = NEW.id_sucursal
  ) THEN
    RAISE EXCEPTION 'El barbero no está asignado a esa sucursal' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER a_horario_sucursal_asignada
  BEFORE INSERT OR UPDATE OF id_sucursal, id_profesional, activo ON public.horario_atencion
  FOR EACH ROW EXECUTE FUNCTION private.validar_horario_sucursal();

-- =====================================================================
-- Invitaciones al equipo y vigencia de la suscripción por fecha
-- (migración invitaciones_y_suscripciones; definiciones completas en la base)
-- =====================================================================
-- v_barberia_modulo y barberia_limite exigen además
--   fecha_termino IS NULL OR fecha_termino >= public.hoy_chile()   (fecha de Chile, no UTC)
-- modulos_barberia(p_barberia) -> text[]  (RPC pública)
-- reservar_como_invitado rechaza si la barbería no tiene el módulo 'agenda'
-- Límite anti-abuso (la función es pública y cada reserva envía un correo): máx. 3 reservas activas
-- futuras por correo y barbería, y 20 reservas de invitados nuevas cada 10 minutos por barbería
-- (check_violation 'Demasiadas reservas pendientes'). Migración reservar_invitado_limite_abuso.

CREATE TABLE public.invitacion (
  id_invitacion bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_barberia   uuid        NOT NULL REFERENCES public.barberia(id_barberia) ON DELETE CASCADE,
  correo        text        NOT NULL,
  rol           text        NOT NULL DEFAULT 'profesional' CHECK (rol IN ('profesional', 'admin')),
  token         uuid        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  estado        text        NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),
  invitado_por  uuid        REFERENCES public.usuario(id_usuario) ON DELETE SET NULL,
  expira_at     timestamptz NOT NULL DEFAULT now() + interval '14 days',
  respondida_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invitacion_pendiente_uk ON public.invitacion (id_barberia, correo) WHERE estado = 'pendiente';
CREATE INDEX invitacion_correo_idx ON public.invitacion (correo) WHERE estado = 'pendiente';

-- a_invitacion_validar (BEFORE INSERT, private.validar_invitacion): normaliza el correo,
-- exige suscripción vigente, rechaza miembros actuales y respeta max_profesionales
-- (barberos activos + invitaciones de barbero pendientes).
-- responder_invitacion(p_token uuid, p_aceptar boolean) -> slug: solo el dueño del correo
-- invitado (confirmado); al aceptar crea usuario_barberia, profesional y, si hay una sola
-- sucursal activa, la asignación profesional_sucursal.

-- =====================================================================
-- Perfil de usuario creado por la base (migración crear_perfil_usuario)
-- =====================================================================
CREATE OR REPLACE FUNCTION private.crear_perfil_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meta    jsonb := NEW.raw_user_meta_data;
  v_version text  := coalesce(nullif(trim(v_meta ->> 'version_politica'), ''), 'desconocida');
  v_acepta  boolean := coalesce(v_meta ->> 'acepta_terminos', '') = 'true';
  -- Google y otros proveedores OAuth no pueden mandar la casilla: aceptan en /cuenta/terminos (lo exige /auth/callback)
  v_oauth   boolean := coalesce(NEW.raw_app_meta_data ->> 'provider', 'email') <> 'email';
BEGIN
  -- app/signup/page.tsx envía acepta_terminos = true solo con la casilla marcada
  IF NOT v_acepta AND NOT v_oauth THEN
    RAISE EXCEPTION 'Debe aceptar los términos y la política de privacidad' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.usuario (id_usuario, nombre, apellido, email)
  VALUES (NEW.id,
          coalesce(nullif(trim(v_meta ->> 'nombre'), ''), nullif(trim(v_meta ->> 'given_name'), ''),
                   nullif(trim(v_meta ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
          coalesce(nullif(trim(v_meta ->> 'apellido'), ''), nullif(trim(v_meta ->> 'family_name'), '')),
          lower(NEW.email))
  ON CONFLICT (id_usuario) DO NOTHING;

  IF v_acepta THEN
    INSERT INTO public.consentimiento (id_usuario, tipo, version_politica, aceptado)
    VALUES (NEW.id, 'terminos', v_version, true),
           (NEW.id, 'privacidad', v_version, true);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER crear_perfil_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.crear_perfil_usuario();

CREATE OR REPLACE FUNCTION private.sincronizar_correo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.usuario SET email = lower(NEW.email) WHERE id_usuario = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sincronizar_correo_usuario
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.sincronizar_correo_usuario();

-- ============================================================================
-- Bitácora del panel de la plataforma (/admin) — migración auditoria_admin
-- ============================================================================
CREATE TABLE public.auditoria_admin (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario  uuid        REFERENCES public.usuario (id_usuario) ON DELETE SET NULL, -- superadmin que actuó
  accion      text        NOT NULL,           -- extender_vigencia, cambiar_plan, suspender_usuario… (ACCION_LABEL en lib/superadmin.ts)
  entidad     text        NOT NULL CHECK (entidad IN ('barberia', 'plan', 'usuario')),
  id_entidad  text        NOT NULL,
  detalle     jsonb       NOT NULL DEFAULT '{}'::jsonb, -- valores antes/después
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_admin_fecha_idx ON public.auditoria_admin (created_at DESC);
CREATE INDEX auditoria_admin_entidad_idx ON public.auditoria_admin (entidad, id_entidad);

-- ============================================================================
-- HU-24 · Google Calendar (el plan_modulo de Premium se asigna al crear los planes)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

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
  updated_at   timestamptz NOT NULL DEFAULT now(),
  bloqueada_hasta timestamptz             -- gcal_reclamar: un worker la está procesando hasta esta hora
);
CREATE INDEX reserva_evento_google_pendiente_idx ON public.reserva_evento_google (updated_at) WHERE pendiente;
CREATE INDEX reserva_evento_google_usuario_idx   ON public.reserva_evento_google (id_usuario);
CREATE INDEX reserva_evento_google_barberia_idx  ON public.reserva_evento_google (id_barberia);

-- Encola la reserva si el profesional vinculó su Google, con o sin el módulo: gcal_reclamar
-- solo entrega las de barberías con 'calendario' en vigencia (lo reservado durante un corte se
-- sincroniza al volver el módulo)
CREATE FUNCTION private.encolar_evento_google()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.calendario_google WHERE id_usuario = NEW.id_profesional) THEN
    INSERT INTO public.reserva_evento_google (id_reserva, id_barberia, id_usuario)
    VALUES (NEW.id_reserva, NEW.id_barberia, NEW.id_profesional)
    ON CONFLICT (id_reserva) DO UPDATE
      SET id_usuario = EXCLUDED.id_usuario, pendiente = true, intentos = 0, ultimo_error = NULL, updated_at = now();
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER reserva_encolar_google
  AFTER INSERT OR UPDATE OF estado, fecha_hora_inicio, fecha_hora_fin, id_profesional, id_sucursal, id_servicio ON public.reserva
  FOR EACH ROW EXECUTE FUNCTION private.encolar_evento_google();

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

-- Recordatorio de cita 24 h antes: cada hora llama a /api/recordatorios (mismo secreto y URL de Vault).
SELECT cron.schedule('recordatorios-reservas', '0 * * * *', $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'site_url') || '/api/recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- Avisos de vencimiento de la suscripción: una vez al día (12:00 UTC).
SELECT cron.schedule('avisos-suscripcion', '0 12 * * *', $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'site_url') || '/api/suscripciones/avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- =====================================================================
-- HU-25 · Pronóstico de demanda (pronóstico)
-- =====================================================================
INSERT INTO public.plan_modulo (id_plan, id_modulo)
SELECT pm.id_plan, c.id_modulo
FROM public.plan_modulo pm
JOIN public.modulo bi ON bi.id_modulo = pm.id_modulo AND bi.codigo = 'bi'
CROSS JOIN public.modulo c WHERE c.codigo = 'pronostico';

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



-- #####################################################################
-- PARTE 2 · SEGURIDAD (RLS, políticas, funciones RPC, Storage, Realtime)
-- #####################################################################

-- =====================================================================
--  Seguridad a nivel de fila (RLS) y funciones RPC
--  Plataforma SaaS multi-tenant para barberías · Proyecto TIHI84
--
--  Se ejecuta DESPUÉS de la PARTE 1.
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

-- El superadmin de la plataforma NO es admin/staff de ninguna barbería (no ve sus datos privados)
CREATE FUNCTION private.es_admin(p_barberia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.rol_en_barberia(p_barberia) = 'admin', false);
$$;

-- Personal de la barbería: administradores y profesionales
CREATE FUNCTION private.es_staff(p_barberia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.rol_en_barberia(p_barberia) IN ('admin','profesional'), false);
$$;

-- Propietario (quien la registró; solo esa cuenta puede eliminarla) y borrado lógico
ALTER TABLE public.barberia
  ADD COLUMN id_propietario uuid REFERENCES public.usuario(id_usuario) ON DELETE SET NULL,
  ADD COLUMN eliminada_at   timestamptz;
CREATE INDEX barberia_propietario_idx ON public.barberia (id_propietario);
-- Una sola prueba gratis por cuenta, y solo en el plan marcado (en producción: Pro)
ALTER TABLE public.plan_suscripcion ADD COLUMN es_plan_prueba boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX plan_suscripcion_un_plan_prueba ON public.plan_suscripcion (es_plan_prueba) WHERE es_plan_prueba;
ALTER TABLE public.usuario ADD COLUMN prueba_usada_at timestamptz;  -- sin GRANT de columna: la escribe registrar_barberia

-- =====================================================================
-- 2. ACTIVAR RLS EN TODAS LAS TABLAS
--    Sin una política que lo permita, una tabla no entrega ni acepta filas.
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- El superadmin opera sobre las tablas de la plataforma (barberías, planes, suscripciones, usuarios).
    -- Nunca sobre los datos privados de cada barbería (clientes, reservas, pedidos, catálogo…): privacidad.
    -- Las de solo lectura/registro tienen sus políticas propias más abajo (pago: solo cobros de suscripción).
    CONTINUE WHEN t IN ('auditoria_admin', 'movimiento_stock', 'calendario_google', 'reserva_evento_google',
                        'reserva', 'reserva_historial', 'pedido', 'detalle_pedido', 'resena', 'direccion_usuario',
                        'consentimiento', 'producto', 'servicio', 'profesional_servicio', 'horario_atencion',
                        'dia_bloqueado', 'prediccion_demanda', 'pago');
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

-- activa, propietario y eliminación: solo la plataforma (superadmin, backend o SQL directo).
-- Es un trigger y no un REVOKE porque el superadmin suspende con su propia sesión.
CREATE FUNCTION private.proteger_barberia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.activa, NEW.id_propietario, NEW.eliminada_at) IS DISTINCT FROM (OLD.activa, OLD.id_propietario, OLD.eliminada_at)
     AND auth.uid() IS NOT NULL AND NOT private.es_superadmin() THEN
    RAISE EXCEPTION 'Solo la plataforma puede cambiar el estado de la barbería' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER barberia_proteger BEFORE UPDATE OF activa, id_propietario, eliminada_at ON public.barberia
  FOR EACH ROW EXECUTE FUNCTION private.proteger_barberia();

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
CREATE POLICY profesional_update_propio ON public.profesional FOR UPDATE TO authenticated
  USING (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia))
  WITH CHECK (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia));

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
CREATE POLICY profesional_servicio_propio ON public.profesional_servicio FOR ALL TO authenticated
  USING (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia))
  WITH CHECK (id_profesional = (SELECT auth.uid()) AND private.es_staff(id_barberia));

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

-- El superadmin solo lee los cobros de suscripción/módulos de la plataforma
CREATE POLICY pago_superadmin_select ON public.pago FOR SELECT TO authenticated
  USING ((SELECT private.es_superadmin()) AND concepto IN ('suscripcion','modulo'));

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

-- prediccion_demanda: la escribe el job de ML (service_role); la ve el admin con módulo pronóstico
CREATE POLICY prediccion_demanda_select_admin ON public.prediccion_demanda FOR SELECT TO authenticated
  USING (private.es_admin(id_barberia) AND public.barberia_tiene_modulo(id_barberia, 'pronostico'));

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
  v_es_plan_prueba boolean;
  v_con_prueba     boolean := false;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Debe iniciar sesión para registrar una barbería' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT precio_mensual, es_plan_prueba INTO v_precio, v_es_plan_prueba
  FROM public.plan_suscripcion WHERE id_plan = p_id_plan AND activo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El plan no existe o no está disponible' USING ERRCODE = 'check_violation';
  END IF;

  -- Una prueba por cuenta y solo en el plan de prueba. El UPDATE es el candado: dos altas a la vez, una gana
  IF v_es_plan_prueba THEN
    UPDATE public.usuario SET prueba_usada_at = now() WHERE id_usuario = v_usuario AND prueba_usada_at IS NULL;
    v_con_prueba := FOUND;
  END IF;

  INSERT INTO public.barberia (nombre, slug, id_propietario) VALUES (p_nombre, p_slug, v_usuario)
  RETURNING id_barberia INTO v_barberia;

  INSERT INTO public.suscripcion (id_barberia, id_plan, precio_pactado, estado, fecha_termino)
  VALUES (v_barberia, p_id_plan, v_precio, 'prueba', public.hoy_chile() + 14);  -- fijo: la RPC es pública

  INSERT INTO public.usuario_barberia (id_usuario, id_barberia, rol)
  VALUES (v_usuario, v_barberia, 'admin');

  INSERT INTO public.sucursal (id_barberia, nombre, direccion, comuna, zona_horaria)
  VALUES (v_barberia, p_sucursal, p_direccion, p_comuna, p_zona_horaria);

  -- Sin prueba queda sin pagar. Recién ahora: sin suscripción vigente el límite de sucursales es 0
  IF NOT v_con_prueba THEN
    UPDATE public.suscripcion SET estado = 'vencida', fecha_termino = public.hoy_chile() WHERE id_barberia = v_barberia;
  END IF;

  RETURN v_barberia;
END $$;

-- 5.1b Borrado lógico de una barbería por su propietario. La llama el backend (service_role) después de
--      cortar el cobro automático (lib/eliminar-barberia.ts). No borra filas, salvo el vínculo de Mercado Pago.
CREATE FUNCTION public.eliminar_barberia(p_barberia uuid, p_usuario uuid)
RETURNS SETOF bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.barberia
  WHERE id_barberia = p_barberia AND id_propietario = p_usuario AND eliminada_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solo el propietario puede eliminar la barbería' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pedido WHERE id_barberia = p_barberia
             AND estado_pago = 'pagado' AND estado NOT IN ('entregado','cancelado')) THEN
    RAISE EXCEPTION 'PEDIDOS_PENDIENTES' USING ERRCODE = 'check_violation';
  END IF;

  -- El slug queda libre para otra barbería
  UPDATE public.barberia
  SET activa = false, eliminada_at = now(), slug = 'eliminada-' || replace(p_barberia::text, '-', '')
  WHERE id_barberia = p_barberia;
  UPDATE public.suscripcion SET estado = 'cancelada', id_suscripcion_externa = NULL
  WHERE id_barberia = p_barberia AND (estado IN ('prueba','activa') OR id_suscripcion_externa IS NOT NULL);
  PERFORM public.mp_borrar(p_barberia);  -- se define más abajo (plpgsql la resuelve al ejecutar)
  UPDATE public.invitacion SET estado = 'cancelada' WHERE id_barberia = p_barberia AND estado = 'pendiente';
  UPDATE public.profesional SET activo = false WHERE id_barberia = p_barberia AND activo;
  UPDATE public.usuario_barberia SET activo = false WHERE id_barberia = p_barberia AND activo;

  -- Devuelve las reservas futuras canceladas para avisarles a los clientes
  RETURN QUERY
  UPDATE public.reserva SET estado = 'cancelada'
  WHERE id_barberia = p_barberia AND estado IN ('pendiente','confirmada') AND fecha_hora_inicio > now()
  RETURNING id_reserva;
END $$;
REVOKE EXECUTE ON FUNCTION public.eliminar_barberia(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.eliminar_barberia(uuid, uuid) TO service_role;

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

-- 5.2c-0 HU-21: la reserva de un invitado es "mía" si su correo es el CONFIRMADO de mi cuenta
--      (sin confirmar, cualquiera podría registrarse con el correo de otra persona).
CREATE FUNCTION private.es_mi_invitado(p_guest uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guest_usuario g
    JOIN auth.users u ON u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
    WHERE g.id_guest = p_guest AND lower(g.correo) = lower(u.email));
$$;

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
  -- coalesce sobre TODA la condición: en una reserva de invitado id_cliente es NULL y la guarda no se disparaba
  IF NOT FOUND OR NOT coalesce(auth.role() = 'service_role' OR r.id_cliente = auth.uid()
                               OR private.es_mi_invitado(r.id_guest), false) THEN
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

-- 5.2d HU-21: historial de la cuenta en todas las barberías, incluidas las reservas hechas como
--      invitado con su correo. SECURITY DEFINER: guest_usuario y barberías inactivas no pasan RLS.
--      shortcut: máximo 200 filas, sin paginación; paginar si algún cliente llega a ese número.
CREATE FUNCTION public.mis_reservas(p_reserva bigint DEFAULT NULL)
RETURNS TABLE (
  id_reserva bigint, fecha_hora_inicio timestamptz, estado text, monto numeric, es_invitado boolean,
  id_barberia uuid, barberia text, slug text, barberia_activa boolean, plazo_cancelacion_min integer,
  id_sucursal bigint, sucursal text, zona_horaria text,
  id_profesional uuid, barbero text,
  id_servicio bigint, servicio text, servicio_precio numeric, duracion_min integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.id_reserva, r.fecha_hora_inicio, r.estado, r.monto::numeric, r.id_guest IS NOT NULL,
         b.id_barberia, b.nombre::text, b.slug, b.activa, b.plazo_cancelacion_min,
         su.id_sucursal, su.nombre::text, su.zona_horaria,
         r.id_profesional, coalesce(p.alias, trim(u.nombre || ' ' || coalesce(u.apellido, '')))::text,
         se.id_servicio, se.nombre::text, se.precio::numeric, se.duracion_min
  FROM public.reserva r
  JOIN public.barberia    b  ON b.id_barberia = r.id_barberia
  JOIN public.sucursal    su ON su.id_sucursal = r.id_sucursal
  JOIN public.servicio    se ON se.id_servicio = r.id_servicio
  JOIN public.profesional p  ON p.id_barberia = r.id_barberia AND p.id_profesional = r.id_profesional
  LEFT JOIN public.usuario u ON u.id_usuario = r.id_profesional
  WHERE (p_reserva IS NULL OR r.id_reserva = p_reserva)
    AND (r.id_cliente = auth.uid() OR (r.id_guest IS NOT NULL AND private.es_mi_invitado(r.id_guest)))
  ORDER BY r.fecha_hora_inicio DESC
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.mis_reservas(bigint) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mis_reservas(bigint) TO authenticated;

-- 5.2e HU-21: ¿mi cuenta tiene contraseña? (las que solo entran con Google no) para pedir la actual al cambiarla
CREATE FUNCTION public.tengo_clave()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND coalesce(encrypted_password, '') <> '');
$$;
REVOKE EXECUTE ON FUNCTION public.tengo_clave() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tengo_clave() TO authenticated;

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
  -- El superadmin la usa desde /admin para las solicitudes de eliminación de datos
  IF NOT (private.es_admin(v_barberia) OR private.es_superadmin()) THEN
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

-- Conteos del panel /admin sin darle al superadmin acceso a las filas de reserva/producto
CREATE FUNCTION public.admin_conteos_barberias(p_desde timestamptz)
RETURNS TABLE (id_barberia uuid, reservas_mes bigint, productos_activos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.es_superadmin() THEN
    RAISE EXCEPTION 'Solo un administrador de la plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT b.id_barberia,
         (SELECT count(*) FROM public.reserva r
           WHERE r.id_barberia = b.id_barberia AND r.estado <> 'cancelada' AND r.fecha_hora_inicio >= p_desde),
         (SELECT count(*) FROM public.producto p WHERE p.id_barberia = b.id_barberia AND p.activo)
  FROM public.barberia b;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_conteos_barberias(timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_conteos_barberias(timestamptz) TO authenticated;

-- Usuarios del panel /admin con filtros y página. Correo confirmado solo está en auth.users.
-- p_tipo (cualquiera de): superadmin, suspendida, eliminada, sin_confirmar
-- p_membresia (cualquiera de): staff (admin/profesional activo), cliente (solo cliente), ninguna
CREATE FUNCTION public.admin_buscar_usuarios(
  p_q text DEFAULT NULL,
  p_tipo text[] DEFAULT NULL,
  p_membresia text[] DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL,
  p_limite integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (id_usuario uuid, nombre text, apellido text, email text, rol text,
               created_at timestamptz, deleted_at timestamptz, email_confirmado boolean, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.es_superadmin() THEN
    RAISE EXCEPTION 'Solo un administrador de la plataforma' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT u.id_usuario, u.nombre::text, u.apellido::text, u.email::text, u.rol::text, u.created_at, u.deleted_at,
           (a.email_confirmed_at IS NOT NULL) AS email_confirmado,
           u.email LIKE '%@anon.invalid' AS eliminada,  -- correo que deja eliminarDatosPersona
           EXISTS (SELECT 1 FROM public.usuario_barberia m WHERE m.id_usuario = u.id_usuario AND m.activo AND m.rol IN ('admin', 'profesional')) AS es_staff,
           EXISTS (SELECT 1 FROM public.usuario_barberia m WHERE m.id_usuario = u.id_usuario AND m.activo) AS tiene_membresia
    FROM public.usuario u
    LEFT JOIN auth.users a ON a.id = u.id_usuario
    WHERE (coalesce(trim(p_q), '') = ''
           OR strpos(lower(u.email), lower(trim(p_q))) > 0
           OR strpos(lower(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')), lower(trim(p_q))) > 0)
      AND (p_desde IS NULL OR (u.created_at AT TIME ZONE 'America/Santiago')::date >= p_desde)
      AND (p_hasta IS NULL OR (u.created_at AT TIME ZONE 'America/Santiago')::date <= p_hasta)
  )
  SELECT b.id_usuario, b.nombre, b.apellido, b.email, b.rol, b.created_at, b.deleted_at, b.email_confirmado,
         count(*) OVER ()
  FROM base b
  WHERE (p_tipo IS NULL OR cardinality(p_tipo) = 0
         OR ('superadmin' = ANY (p_tipo) AND b.rol = 'superadmin')
         OR ('suspendida' = ANY (p_tipo) AND b.deleted_at IS NOT NULL AND NOT b.eliminada)
         OR ('eliminada' = ANY (p_tipo) AND b.eliminada)
         OR ('sin_confirmar' = ANY (p_tipo) AND NOT b.email_confirmado))
    AND (p_membresia IS NULL OR cardinality(p_membresia) = 0
         OR ('staff' = ANY (p_membresia) AND b.es_staff)
         OR ('cliente' = ANY (p_membresia) AND b.tiene_membresia AND NOT b.es_staff)
         OR ('ninguna' = ANY (p_membresia) AND NOT b.tiene_membresia))
  ORDER BY b.created_at DESC, b.id_usuario
  LIMIT least(greatest(p_limite, 1), 100) OFFSET greatest(p_offset, 0);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_buscar_usuarios(text, text[], text[], date, date, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_buscar_usuarios(text, text[], text[], date, date, integer, integer) TO authenticated;

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
                   AND (s.fecha_termino IS NULL OR s.fecha_termino >= public.hoy_chile())) THEN
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

-- ---------------- HU-24 · Google Calendar (Google Calendar) ----------------
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

-- Entrega hasta p_limite filas pendientes al worker y las reserva 2 minutos (SKIP LOCKED + lease:
-- dos ejecuciones simultáneas nunca toman la misma). Solo barberías con 'calendario' en vigencia;
-- las de 20+ intentos se reintentan una vez por hora.
CREATE FUNCTION public.gcal_reclamar(p_limite integer)
RETURNS SETOF public.reserva_evento_google LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.reserva_evento_google q SET bloqueada_hasta = now() + interval '2 minutes'
  FROM (
    SELECT e.id_reserva FROM public.reserva_evento_google e
    WHERE e.pendiente
      AND (e.bloqueada_hasta IS NULL OR e.bloqueada_hasta < now())
      AND (e.intentos < 20 OR e.updated_at < now() - interval '1 hour')
      AND (public.barberia_tiene_modulo(e.id_barberia, 'calendario')
           -- quitar un evento no depende del módulo: si no, al eliminar la barbería quedan citas fantasma
           OR EXISTS (SELECT 1 FROM public.reserva r WHERE r.id_reserva = e.id_reserva AND r.estado = 'cancelada'))
    ORDER BY e.updated_at
    LIMIT p_limite
    FOR UPDATE OF e SKIP LOCKED
  ) c
  WHERE q.id_reserva = c.id_reserva
  RETURNING q.*;
$$;

REVOKE EXECUTE ON FUNCTION public.gcal_guardar_token(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gcal_token(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gcal_borrar(uuid)              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_guardar_token(uuid, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.gcal_token(uuid)               TO service_role;
GRANT  EXECUTE ON FUNCTION public.gcal_borrar(uuid)              TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_reclamar(integer)         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_reclamar(integer)         TO service_role;

-- ---------------- Mercado Pago de cada barbería (OAuth) ----------------
-- Los pagos de la tienda van directo a la cuenta de la barbería; las suscripciones, a la de Sunwalk.
-- Access y refresh token viven en Vault (id_secreto); solo el backend (service role) los lee o escribe.
CREATE TABLE public.barberia_mercadopago (
  id_barberia  uuid        PRIMARY KEY REFERENCES public.barberia (id_barberia) ON DELETE CASCADE,
  mp_user_id   bigint      NOT NULL UNIQUE,   -- id del vendedor en Mercado Pago (llega en las notificaciones)
  cuenta       text,                          -- nickname o correo, solo para mostrar "conectado como …"
  id_secreto   uuid        NOT NULL,          -- vault.secrets.id (nombre 'mp_<id_barberia>'), JSON {access_token, refresh_token}
  expira_at    timestamptz NOT NULL,          -- vencimiento del access token
  estado       text        NOT NULL DEFAULT 'conectada' CHECK (estado IN ('conectada', 'desconectada')),
  conectado_at timestamptz NOT NULL DEFAULT now(),
  ultimo_error text
);

-- RLS: el admin de la barbería lee solo las columnas no secretas; escribe únicamente el backend.
-- Sin política de superadmin (privacidad de la barbería).
ALTER TABLE public.barberia_mercadopago ENABLE ROW LEVEL SECURITY;
CREATE POLICY barberia_mercadopago_select ON public.barberia_mercadopago FOR SELECT TO authenticated
  USING ((SELECT private.es_admin(id_barberia)));
REVOKE ALL ON public.barberia_mercadopago FROM anon, authenticated;
GRANT SELECT (id_barberia, mp_user_id, cuenta, expira_at, estado, conectado_at, ultimo_error)
  ON public.barberia_mercadopago TO authenticated;

CREATE FUNCTION public.mp_guardar_token(p_barberia uuid, p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'mp_' || p_barberia;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_token, 'mp_' || p_barberia, 'Tokens OAuth de Mercado Pago');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION public.mp_token(p_barberia uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.decrypted_secret FROM vault.decrypted_secrets d
  JOIN public.barberia_mercadopago m ON m.id_secreto = d.id
  WHERE m.id_barberia = p_barberia;
$$;

-- Desconecta: borra el secreto y el vínculo
CREATE FUNCTION public.mp_borrar(p_barberia uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM vault.secrets WHERE name = 'mp_' || p_barberia;
  DELETE FROM public.barberia_mercadopago WHERE id_barberia = p_barberia;
$$;

REVOKE EXECUTE ON FUNCTION public.mp_guardar_token(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mp_token(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mp_borrar(uuid)              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mp_guardar_token(uuid, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.mp_token(uuid)               TO service_role;
GRANT  EXECUTE ON FUNCTION public.mp_borrar(uuid)              TO service_role;

-- La tienda pública solo necesita saber si la barbería puede cobrar; los tokens y la cuenta no se exponen.
CREATE FUNCTION public.barberia_acepta_pagos(p_barberia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.barberia_mercadopago WHERE id_barberia = p_barberia AND estado = 'conectada');
$$;
REVOKE EXECUTE ON FUNCTION public.barberia_acepta_pagos(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.barberia_acepta_pagos(uuid) TO anon, authenticated, service_role;




-- #####################################################################
-- PARTE 3 · ESTADÍSTICAS (módulo BI)
-- #####################################################################

-- =====================================================================
-- MÓDULO BI (HU-13..16 · KPI-01..07)
-- Funciones SECURITY INVOKER: el RLS de las tablas base sigue aplicando.
-- Las ve el staff de una barbería con el módulo 'bi' (CP-29). El admin ve todo; un profesional
-- solo sus citas (se fuerza auth.uid() sin importar los parámetros) y nunca los productos.
-- Se aplica con el MCP de Supabase (apply_migration); este archivo es la referencia
-- del estado actual (para cambiar una firma hay que DROP + CREATE: CREATE OR REPLACE no basta).
--
-- Filtros opcionales (NULL = sin filtrar): sucursal, profesional, servicio y tipo de ingreso.
-- Los productos no tienen profesional ni servicio: con alguno de esos filtros quedan fuera de
-- bi_ingresos; pedido.id_sucursal es opcional, así que filtrar por sucursal excluye los pedidos sin ella.
-- =====================================================================

CREATE FUNCTION private.bi_verificar(p_barberia uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF NOT (private.es_staff(p_barberia) AND public.barberia_tiene_modulo(p_barberia, 'bi')) THEN
    RAISE EXCEPTION 'Sin acceso al módulo de estadísticas' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- Reservas del rango con la fecha/hora en la zona horaria de su sucursal
CREATE FUNCTION public.bi_reservas(
  p_barberia uuid, p_desde date, p_hasta date,
  p_sucursal bigint DEFAULT NULL, p_profesional uuid DEFAULT NULL, p_servicio bigint DEFAULT NULL)
RETURNS TABLE (id_reserva bigint, fecha date, hora integer, dow integer, estado text,
               id_servicio bigint, id_profesional uuid, monto numeric, minutos numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_prof uuid;
BEGIN
  PERFORM private.bi_verificar(p_barberia);
  -- un profesional solo ve lo suyo, sin importar el parámetro
  v_prof := CASE WHEN private.es_admin(p_barberia) THEN p_profesional ELSE auth.uid() END;
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
      AND (p_sucursal IS NULL OR r.id_sucursal = p_sucursal)
      AND (v_prof IS NULL OR r.id_profesional = v_prof)
      AND (p_servicio IS NULL OR r.id_servicio = p_servicio)
  ) x
  WHERE x.f BETWEEN p_desde AND p_hasta;
END $$;

-- Pedidos pagados; la fecha es la del primer pago aprobado (la spec no la define)
CREATE FUNCTION public.bi_pedidos_pagados(
  p_barberia uuid, p_desde date, p_hasta date, p_sucursal bigint DEFAULT NULL)
RETURNS TABLE (id_pedido bigint, fecha date, monto numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_tz text;
BEGIN
  PERFORM private.bi_verificar(p_barberia);
  -- las ventas de productos son solo del admin: al profesional no le devuelve nada
  IF NOT private.es_admin(p_barberia) THEN RETURN; END IF;
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
      AND (p_sucursal IS NULL OR p.id_sucursal = p_sucursal)
  ) x
  WHERE x.f BETWEEN p_desde AND p_hasta;
END $$;

-- KPI-01 · HU-13. p_tipo: 'servicios' | 'productos' | NULL (ambos)
CREATE FUNCTION public.bi_ingresos(
  p_barberia uuid, p_desde date, p_hasta date, p_gran text DEFAULT 'day', p_tipo text DEFAULT NULL,
  p_sucursal bigint DEFAULT NULL, p_profesional uuid DEFAULT NULL, p_servicio bigint DEFAULT NULL)
RETURNS TABLE (periodo date, servicios numeric, productos numeric, total numeric, transacciones bigint)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF p_gran NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Granularidad inválida: %', p_gran USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_tipo IS NOT NULL AND p_tipo NOT IN ('servicios', 'productos') THEN
    RAISE EXCEPTION 'Tipo inválido: %', p_tipo USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN QUERY
  WITH m AS (
    SELECT r.fecha, 'servicio'::text AS tipo, r.monto
    FROM public.bi_reservas(p_barberia, p_desde, p_hasta, p_sucursal, p_profesional, p_servicio) r
    WHERE r.estado = 'completada' AND (p_tipo IS NULL OR p_tipo = 'servicios')
    UNION ALL
    SELECT pp.fecha, 'producto', pp.monto
    FROM public.bi_pedidos_pagados(p_barberia, p_desde, p_hasta, p_sucursal) pp
    WHERE (p_tipo IS NULL OR p_tipo = 'productos') AND p_profesional IS NULL AND p_servicio IS NULL
  )
  SELECT date_trunc(p_gran, m.fecha)::date,
         coalesce(sum(m.monto) FILTER (WHERE m.tipo = 'servicio'), 0),
         coalesce(sum(m.monto) FILTER (WHERE m.tipo = 'producto'), 0),
         sum(m.monto), count(*)
  FROM m GROUP BY 1 ORDER BY 1;
END $$;

-- KPI-02 · HU-14
CREATE FUNCTION public.bi_servicios(
  p_barberia uuid, p_desde date, p_hasta date, p_sucursal bigint DEFAULT NULL, p_profesional uuid DEFAULT NULL)
RETURNS TABLE (id_servicio bigint, nombre text, cantidad bigint, ingresos numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT s.id_servicio, s.nombre, count(*), sum(r.monto)
  FROM public.bi_reservas(p_barberia, p_desde, p_hasta, p_sucursal, p_profesional, NULL) r
  JOIN public.servicio s ON s.id_barberia = p_barberia AND s.id_servicio = r.id_servicio
  WHERE r.estado = 'completada'
  GROUP BY s.id_servicio, s.nombre
  ORDER BY count(*) DESC, sum(r.monto) DESC;
$$;

-- KPI-03 · HU-14
CREATE FUNCTION public.bi_productos(
  p_barberia uuid, p_desde date, p_hasta date, p_sucursal bigint DEFAULT NULL)
RETURNS TABLE (id_producto bigint, nombre text, unidades bigint, monto numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pr.id_producto, pr.nombre, sum(d.cantidad), sum(d.subtotal)
  FROM public.bi_pedidos_pagados(p_barberia, p_desde, p_hasta, p_sucursal) pp
  JOIN public.detalle_pedido d ON d.id_barberia = p_barberia AND d.id_pedido = pp.id_pedido
  JOIN public.producto pr ON pr.id_barberia = p_barberia AND pr.id_producto = d.id_producto
  GROUP BY pr.id_producto, pr.nombre
  ORDER BY sum(d.cantidad) DESC, sum(d.subtotal) DESC;
$$;

-- KPI-04 · HU-15: reservas no canceladas por día de la semana (0 = domingo) y hora local
CREATE FUNCTION public.bi_demanda(
  p_barberia uuid, p_desde date, p_hasta date,
  p_sucursal bigint DEFAULT NULL, p_profesional uuid DEFAULT NULL, p_servicio bigint DEFAULT NULL)
RETURNS TABLE (dow integer, hora integer, citas bigint)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT r.dow, r.hora, count(*)
  FROM public.bi_reservas(p_barberia, p_desde, p_hasta, p_sucursal, p_profesional, p_servicio) r
  WHERE r.estado <> 'cancelada'
  GROUP BY r.dow, r.hora
  ORDER BY r.dow, r.hora;
$$;

-- KPI-05: minutos reservados / minutos de atención publicados (sin días bloqueados), por profesional
CREATE FUNCTION public.bi_ocupacion(
  p_barberia uuid, p_desde date, p_hasta date, p_sucursal bigint DEFAULT NULL, p_profesional uuid DEFAULT NULL)
RETURNS TABLE (id_profesional uuid, nombre text, minutos_publicados numeric, minutos_reservados numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_prof uuid;
BEGIN
  PERFORM private.bi_verificar(p_barberia);
  v_prof := CASE WHEN private.es_admin(p_barberia) THEN p_profesional ELSE auth.uid() END;
  RETURN QUERY
  WITH pub AS (
    SELECT ha.id_profesional AS idp,
           sum(extract(epoch FROM ha.hora_fin - ha.hora_inicio) / 60) AS min_pub
    FROM generate_series(p_desde, p_hasta, interval '1 day') g
    JOIN public.horario_atencion ha
      ON ha.id_barberia = p_barberia AND ha.activo AND ha.dia_semana = extract(dow FROM g)::int
     AND (p_sucursal IS NULL OR ha.id_sucursal = p_sucursal)
     AND (v_prof IS NULL OR ha.id_profesional = v_prof)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.dia_bloqueado b
      WHERE b.id_barberia = p_barberia AND b.id_profesional = ha.id_profesional AND b.fecha = g::date)
    GROUP BY ha.id_profesional
  ), res AS (
    SELECT r.id_profesional AS idp, sum(r.minutos) AS min_res
    FROM public.bi_reservas(p_barberia, p_desde, p_hasta, p_sucursal, v_prof, NULL) r
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

-- KPI-06 y KPI-07 por mes. tasa_no_show es NULL si no hubo completadas ni inasistencias.
-- Con profesional o servicio el ticket sale solo de servicios (los productos no tienen ninguno de los dos).
CREATE FUNCTION public.bi_resumen_mensual(
  p_barberia uuid, p_desde date, p_hasta date,
  p_sucursal bigint DEFAULT NULL, p_profesional uuid DEFAULT NULL, p_servicio bigint DEFAULT NULL)
RETURNS TABLE (mes date, ingresos numeric, transacciones bigint, ticket_promedio numeric,
               completadas bigint, no_asistio bigint, tasa_no_show numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH ing AS (
    SELECT periodo AS mes, total, transacciones
    FROM public.bi_ingresos(p_barberia, p_desde, p_hasta, 'month', NULL, p_sucursal, p_profesional, p_servicio)
  ), asis AS (
    SELECT date_trunc('month', r.fecha)::date AS mes,
           count(*) FILTER (WHERE r.estado = 'completada') AS completadas,
           count(*) FILTER (WHERE r.estado = 'no_asistio') AS no_asistio
    FROM public.bi_reservas(p_barberia, p_desde, p_hasta, p_sucursal, p_profesional, p_servicio) r
    GROUP BY 1
  )
  SELECT coalesce(i.mes, a.mes), coalesce(i.total, 0), coalesce(i.transacciones, 0),
         round(i.total / nullif(i.transacciones, 0)),
         coalesce(a.completadas, 0), coalesce(a.no_asistio, 0),
         round(100.0 * a.no_asistio / nullif(a.completadas + a.no_asistio, 0), 1)
  FROM ing i FULL JOIN asis a ON a.mes = i.mes
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION private.bi_verificar(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_reservas(uuid, date, date, bigint, uuid, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_pedidos_pagados(uuid, date, date, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_ingresos(uuid, date, date, text, text, bigint, uuid, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_servicios(uuid, date, date, bigint, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_productos(uuid, date, date, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_demanda(uuid, date, date, bigint, uuid, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_ocupacion(uuid, date, date, bigint, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bi_resumen_mensual(uuid, date, date, bigint, uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.bi_verificar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_reservas(uuid, date, date, bigint, uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_pedidos_pagados(uuid, date, date, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_ingresos(uuid, date, date, text, text, bigint, uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_servicios(uuid, date, date, bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_productos(uuid, date, date, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_demanda(uuid, date, date, bigint, uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_ocupacion(uuid, date, date, bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_resumen_mensual(uuid, date, date, bigint, uuid, bigint) TO authenticated;
