# Barbería BENJVMIN

> Sistema de reservas online y e-commerce para una barbería profesional en Valdivia, Chile.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-database-green?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Deploy](https://img.shields.io/badge/Desplegado%20en-Vercel-black?logo=vercel)](https://projecto-barberia.vercel.app/)

---

## Descripción

**Barbería BENJVMIN** es una aplicación web full-stack que permite a los clientes reservar citas online, explorar y comprar productos de cuidado personal, y dejar reseñas. Los barberos cuentan con un panel de administración para gestionar su agenda, clientes, servicios y ventas.

**Demo en vivo:** [projecto-barberia.vercel.app](https://projecto-barberia.vercel.app/)

---

## Funcionalidades

- **Reserva de citas** — Los clientes pueden ver los barberos disponibles, elegir servicios y reservar un horario en tiempo real.
- **Tienda online** — Catálogo de productos con carrito persistente e integración de pago con MercadoPago.
- **Panel de barbero** — Interfaz completa para gestionar citas, clientes, servicios, horarios y fechas bloqueadas.
- **Reseñas de clientes** — Sistema de calificación por estrellas con carrusel público en la página principal.
- **Acceso por roles** — Flujos separados para barberos (`/dashboard`) y clientes (`/profile`).
- **Modo oscuro / claro** — Cambio de tema automático según el sistema, usando `next-themes`.
- **Reserva como invitado** — Los visitantes pueden reservar citas sin necesidad de crear una cuenta.
- **Seguimiento de ventas** — Historial de pedidos y estadísticas de ingresos para los barberos.
- **Eliminación suave** — Los productos y servicios se archivan (no se eliminan) para conservar el historial.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5 |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (SSR) |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Estado global | Zustand (carrito persistente) |
| Pagos | MercadoPago SDK |
| Gráficos | Recharts |
| Calendario | react-day-picker |
| Carrusel | Embla Carousel |
| Notificaciones | Sonner |
| Despliegue | Vercel |

---

## Instalación

### Requisitos previos

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- Un proyecto en [Supabase](https://supabase.com/)
- Una cuenta de desarrollador en [MercadoPago](https://www.mercadopago.com/)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/projecto-barberia.git
cd projecto-barberia

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno (ver sección más abajo)
cp .env.example .env.local

# 4. Iniciar el servidor de desarrollo
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=tu-access-token
MERCADOPAGO_WEBHOOK_SECRET=tu-webhook-secret
```

> **Nota:** Nunca subas el archivo `.env.local` al control de versiones.

---

## Estructura del proyecto

```
projecto-barberia/
├── app/                        # Páginas con Next.js App Router
│   ├── page.tsx                # Página de inicio
│   ├── layout.tsx              # Layout raíz (ThemeProvider, Toaster)
│   ├── agendar/                # Flujo de reserva de citas
│   ├── tienda/                 # Tienda de productos
│   ├── carrito/                # Carrito de compras
│   ├── checkout/               # Página de pago
│   ├── dashboard/              # Panel de administración del barbero
│   │   ├── clientes/           # Lista y detalle de clientes
│   │   ├── citas/              # Gestión de citas
│   │   ├── productos/          # CRUD de productos
│   │   ├── servicios/          # Servicios del barbero
│   │   ├── horarios/           # Horarios y fechas bloqueadas
│   │   ├── estadisticas/       # Estadísticas de ingresos y reservas
│   │   └── pedidos/            # Gestión de pedidos
│   ├── profile/                # Perfil del cliente
│   ├── login/                  # Autenticación
│   ├── signup/                 # Registro
│   └── api/                    # Rutas API
│       ├── checkout/           # Crea la preferencia de MercadoPago
│       └── webhooks/           # Webhook de pagos de MercadoPago
│
├── components/                 # Componentes reutilizables
│   ├── dashboard/              # Componentes del panel de administración
│   ├── booking/                # Componentes del flujo de reserva
│   ├── shop/                   # Componentes de la tienda
│   ├── reviews/                # Carrusel de reseñas
│   └── ui/                     # Componentes base de shadcn/ui
│
├── lib/
│   ├── services/               # Toda la lógica de base de datos
│   │   ├── barber-service.ts
│   │   ├── booking-service.ts
│   │   ├── dashboard-service.ts
│   │   ├── product-service.ts
│   │   ├── schedule-service.ts
│   │   └── service-service.ts
│   ├── cart-store.ts           # Estado del carrito con Zustand
│   └── database.types.ts       # Tipos TypeScript de la base de datos
│
├── utils/
│   └── supabase/               # Instancias del cliente Supabase
│       ├── client.ts           # Cliente para el navegador
│       ├── server.ts           # Cliente para el servidor (SSR + auth)
│       └── service-role.ts     # Cliente admin (omite RLS)
│
└── proxy.ts                    # Middleware (re-exporta desde utils/supabase/middleware.ts)
```

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/checkout` | Crea un registro de `venta` y una preferencia de pago en MercadoPago. Retorna la URL `init_point`. |
| `POST` | `/api/webhooks/mercadopago` | Recibe eventos de pago, verifica la firma HMAC-SHA256 y actualiza `venta.estado_pago`. |
| `POST` | `/api/admin/create-user` | Utilidad de administración para crear cuentas de usuario. |
| `GET` | `/api/profile` | Retorna el perfil del usuario autenticado. |
| `GET` | `/api/reviews` | Obtiene las reseñas públicas aprobadas. |
| `POST` | `/api/confirm-booking` | Confirma una reserva pendiente. |
| `POST` | `/api/cancel-booking` | Cancela una reserva existente. |

---

## Scripts disponibles

```bash
pnpm dev        # Inicia el servidor de desarrollo en localhost:3000
pnpm build      # Genera la build de producción
pnpm start      # Inicia el servidor de producción
pnpm lint       # Ejecuta ESLint
```

---

## Acceso por roles

| Rol | Redirección | Descripción |
|---|---|---|
| `barbero` | `/dashboard` | Panel completo de administración |
| `cliente` | `/profile` | Perfil del cliente e historial de reservas |

El layout del dashboard crea automáticamente los registros de `barbero` y `usuario` en la base de datos al iniciar sesión por primera vez.

---

*Desarrollado con Next.js y Supabase.*
