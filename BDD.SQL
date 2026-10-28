-- =====================================================================
--  Esquema completo v3 — Plataforma SaaS multi-tenant para barberías
--  Proyecto TIHI84 · PostgreSQL 15+ (Supabase)
--
--  Crea la base de datos desde cero, en orden de dependencias.
--  Las políticas de acceso (RLS) y las funciones RPC están en rls.sql,
--  que se ejecuta DESPUÉS de este script.
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
    'eliminar-datos','reembolsos','cookies',
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
  fecha_inicio            date             NOT NULL DEFAULT current_date,
  fecha_termino           date,
  estado                  text             NOT NULL DEFAULT 'activa',
  id_suscripcion_externa  text,                        -- id de la suscripción recurrente en la pasarela
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
  fecha_inicio           date             NOT NULL DEFAULT current_date,
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
  ('bi',        'Inteligencia de negocio', 'Indicadores y predicción de demanda',                              false);

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
                             'booking-confirmed','booking-cancelled'])
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
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediccion_demanda_pkey PRIMARY KEY (id_prediccion),
  CONSTRAINT prediccion_demanda_id_barberia_fkey FOREIGN KEY (id_barberia) REFERENCES public.barberia(id_barberia),
  CONSTRAINT prediccion_demanda_producto_fkey FOREIGN KEY (id_barberia, id_producto)
             REFERENCES public.producto(id_barberia, id_producto),
  CONSTRAINT prediccion_demanda_tipo_check CHECK (tipo IN ('producto','reservas','ingresos')),
  CONSTRAINT prediccion_demanda_mape_check CHECK (mape >= 0),
  CONSTRAINT prediccion_producto_coherente CHECK ((tipo = 'producto') = (id_producto IS NOT NULL))
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
UNION
SELECT s.id_barberia, m.id_modulo, m.codigo, 'plan'
FROM public.suscripcion s
JOIN public.plan_modulo pm ON pm.id_plan = s.id_plan
JOIN public.modulo m       ON m.id_modulo = pm.id_modulo AND m.activo
WHERE s.estado IN ('prueba','activa')
UNION
SELECT sm.id_barberia, m.id_modulo, m.codigo, 'adicional'
FROM public.suscripcion_modulo sm
JOIN public.modulo m ON m.id_modulo = sm.id_modulo AND m.activo
WHERE sm.estado = 'activo'
  AND (sm.fecha_termino IS NULL OR sm.fecha_termino >= current_date);

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

-- Módulos requeridos
CREATE TRIGGER producto_requiere_ecommerce
  BEFORE INSERT ON public.producto
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('ecommerce');
CREATE TRIGGER pedido_requiere_ecommerce
  BEFORE INSERT ON public.pedido
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('ecommerce');
CREATE TRIGGER prediccion_requiere_bi
  BEFORE INSERT ON public.prediccion_demanda
  FOR EACH ROW EXECUTE FUNCTION public.validar_modulo_contratado('bi');

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
  IF OLD.estado = 'cancelado' AND NEW.estado <> 'cancelado' THEN
    RAISE EXCEPTION 'Un pedido cancelado no se puede reactivar' USING ERRCODE = 'check_violation';
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

-- 9.5 Detalle de pedido: precio vigente, descuento de stock con bloqueo
CREATE FUNCTION public.detalle_pedido_antes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_estado text;
  v_precio numeric;
  v_activo boolean;
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
    SELECT pr.precio, pr.activo INTO v_precio, v_activo
    FROM public.producto pr
    WHERE pr.id_barberia = NEW.id_barberia AND pr.id_producto = NEW.id_producto;
    IF NOT FOUND OR NOT v_activo THEN
      RAISE EXCEPTION 'El producto no está disponible' USING ERRCODE = 'check_violation';
    END IF;
    NEW.precio_unitario := v_precio;              -- el cliente no fija el precio
    UPDATE public.producto
    SET stock = stock - NEW.cantidad
    WHERE id_barberia = NEW.id_barberia AND id_producto = NEW.id_producto
      AND stock >= NEW.cantidad;                  -- el UPDATE bloquea la fila: sin sobreventa
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.id_producto USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE: solo en pedidos pendientes (o en cascada al borrar el pedido);
  -- devuelve el stock salvo que el pedido ya esté cancelado (ya se devolvió)
  IF v_estado IS NOT NULL AND v_estado NOT IN ('pendiente','cancelado') THEN
    RAISE EXCEPTION 'Solo se pueden quitar productos de un pedido pendiente' USING ERRCODE = 'check_violation';
  END IF;
  IF v_estado IS DISTINCT FROM 'cancelado' THEN
    UPDATE public.producto SET stock = stock + OLD.cantidad
    WHERE id_barberia = OLD.id_barberia AND id_producto = OLD.id_producto;
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

-- 9.6 Al cancelar un pedido se devuelve el stock
CREATE FUNCTION public.devolver_stock_pedido_cancelado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.estado = 'cancelado' AND OLD.estado <> 'cancelado' THEN
    UPDATE public.producto pr
    SET stock = pr.stock + d.cantidad
    FROM public.detalle_pedido d
    WHERE d.id_barberia = NEW.id_barberia AND d.id_pedido = NEW.id_pedido
      AND pr.id_barberia = d.id_barberia AND pr.id_producto = d.id_producto;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER pedido_devolver_stock
  AFTER UPDATE OF estado ON public.pedido
  FOR EACH ROW EXECUTE FUNCTION public.devolver_stock_pedido_cancelado();

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
--   fecha_termino IS NULL OR fecha_termino >= CURRENT_DATE
-- modulos_barberia(p_barberia) -> text[]  (RPC pública)
-- reservar_como_invitado rechaza si la barbería no tiene el módulo 'agenda'

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
  v_version text := coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'version_politica'), ''), 'desconocida');
BEGIN
  -- app/signup/page.tsx envía acepta_terminos = true solo con la casilla marcada
  IF coalesce(NEW.raw_user_meta_data ->> 'acepta_terminos', '') <> 'true' THEN
    RAISE EXCEPTION 'Debe aceptar los términos y la política de privacidad' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.usuario (id_usuario, nombre, apellido, email)
  VALUES (NEW.id,
          coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'nombre'), ''), split_part(NEW.email, '@', 1)),
          nullif(trim(NEW.raw_user_meta_data ->> 'apellido'), ''),
          lower(NEW.email))
  ON CONFLICT (id_usuario) DO NOTHING;

  INSERT INTO public.consentimiento (id_usuario, tipo, version_politica, aceptado)
  VALUES (NEW.id, 'terminos', v_version, true),
         (NEW.id, 'privacidad', v_version, true);
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
