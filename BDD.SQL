-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.barbero (
  id uuid NOT NULL,
  especialidad character varying,
  nombre character varying NOT NULL,
  apellido character varying,
  CONSTRAINT barbero_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_id_fkey FOREIGN KEY (id) REFERENCES public.usuario(id)
);
CREATE TABLE public.barbero_servicio (
  id integer NOT NULL DEFAULT nextval('barbero_servicio_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  barbero uuid,
  servicio bigint,
  CONSTRAINT barbero_servicio_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_servicio_servicio_fkey FOREIGN KEY (servicio) REFERENCES public.servicio(id),
  CONSTRAINT barbero_servicio_barbero_fkey FOREIGN KEY (barbero) REFERENCES public.barbero(id)
);
CREATE TABLE public.detalle_venta (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  cantidad numeric NOT NULL,
  subtotal numeric NOT NULL,
  producto bigint NOT NULL,
  CONSTRAINT detalle_venta_pkey PRIMARY KEY (id),
  CONSTRAINT detalle_venta_id_fkey FOREIGN KEY (id) REFERENCES public.venta(id),
  CONSTRAINT detalle_venta_producto_fkey FOREIGN KEY (producto) REFERENCES public.productos(id)
);
CREATE TABLE public.dia_bloqueado (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  barbero uuid NOT NULL,
  fecha date NOT NULL,
  motivo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dia_bloqueado_pkey PRIMARY KEY (id),
  CONSTRAINT dia_bloqueado_barbero_fkey FOREIGN KEY (barbero) REFERENCES public.barbero(id)
);
CREATE TABLE public.guest_usuario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  correo character varying NOT NULL,
  telefono text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT guest_usuario_pkey PRIMARY KEY (id)
);
CREATE TABLE public.horario_barbero (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  barbero uuid NOT NULL,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT horario_barbero_pkey PRIMARY KEY (id),
  CONSTRAINT horario_barbero_barbero_fkey FOREIGN KEY (barbero) REFERENCES public.barbero(id)
);
CREATE TABLE public.productos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL,
  imagen_url text,
  categoria text NOT NULL,
  stock integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  rating numeric,
  tag text,
  CONSTRAINT productos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.resena (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  comentario text,
  calificacion numeric NOT NULL,
  servicio bigint,
  barbero uuid,
  producto bigint,
  cliente uuid,
  CONSTRAINT resena_pkey PRIMARY KEY (id),
  CONSTRAINT resena_servicio_fkey FOREIGN KEY (servicio) REFERENCES public.servicio(id),
  CONSTRAINT resena_barbero_fkey FOREIGN KEY (barbero) REFERENCES public.barbero(id),
  CONSTRAINT resena_producto_fkey FOREIGN KEY (producto) REFERENCES public.productos(id),
  CONSTRAINT resena_cliente_fkey FOREIGN KEY (cliente) REFERENCES public.usuario(id)
);
CREATE TABLE public.reserva (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha date NOT NULL,
  hora time with time zone NOT NULL,
  estado character varying,
  barbero uuid NOT NULL,
  cliente uuid,
  servicio bigint NOT NULL,
  guest_cliente uuid,
  notas text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reserva_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_servicio_fkey FOREIGN KEY (servicio) REFERENCES public.servicio(id),
  CONSTRAINT reserva_guest_cliente_fkey FOREIGN KEY (guest_cliente) REFERENCES public.guest_usuario(id),
  CONSTRAINT reserva_barbero_fkey FOREIGN KEY (barbero) REFERENCES public.barbero(id),
  CONSTRAINT reserva_cliente_fkey FOREIGN KEY (cliente) REFERENCES public.usuario(id)
);
CREATE TABLE public.servicio (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  descripcion text,
  precio numeric NOT NULL,
  duracion numeric,
  CONSTRAINT servicio_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuario (
  id uuid NOT NULL,
  nombre character varying NOT NULL,
  apellido character varying,
  correo character varying NOT NULL,
  telefono text,
  rol character varying NOT NULL,
  profile_image text,
  CONSTRAINT usuario_pkey PRIMARY KEY (id),
  CONSTRAINT usuario_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.venta (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha date NOT NULL,
  hora time with time zone NOT NULL DEFAULT now(),
  estado text,
  total numeric NOT NULL,
  usuario uuid NOT NULL,
  detalle bigint NOT NULL,
  CONSTRAINT venta_pkey PRIMARY KEY (id),
  CONSTRAINT venta_usuario_fkey FOREIGN KEY (usuario) REFERENCES public.usuario(id),
  CONSTRAINT venta_detalle_fkey FOREIGN KEY (detalle) REFERENCES public.detalle_venta(id)
);