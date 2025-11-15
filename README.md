# Barbería BENJVMIN - Sistema de Reservas

Sistema de reservas online para barbería profesional construido con Next.js, Supabase y shadcn/ui. Incluye gestión de citas, confirmación por email, dashboard administrativo y galería de cortes recientes.

## ✨ Características

- 📅 **Sistema de reservas** - Reserva de citas con selección de servicio, barbero, fecha y hora
- ✉️ **Confirmación por email** - Emails automáticos con botón de confirmación usando Resend
- 👨‍💼 **Dashboard administrativo** - Panel de control para gestionar citas y clientes
- 🖼️ **Galería dinámica** - Carrusel de cortes recientes desde Supabase Storage
- 🌓 **Tema claro/oscuro** - Cambio automático de logo según el tema
- 📱 **Responsive** - Diseño adaptable para móviles, tablets y desktop
- 🔐 **Autenticación** - Sistema de autenticación con Supabase Auth

## 🛠️ Tecnologías

- **Framework:** Next.js 16 (App Router)
- **Base de datos:** Supabase (PostgreSQL)
- **Autenticación:** Supabase Auth
- **Storage:** Supabase Storage
- **Email:** Resend
- **UI Components:** shadcn/ui + Radix UI
- **Estilos:** Tailwind CSS 4
- **Iconos:** Lucide React
- **Lenguaje:** TypeScript

## 📋 Requisitos Previos

- Node.js 18+ instalado
- pnpm instalado (`npm install -g pnpm`)
- Cuenta de Supabase
- Cuenta de Resend (para emails)

## 🚀 Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd projecto-barberia
```

2. **Instalar dependencias**
```bash
pnpm install
```

3. **Configurar variables de entorno**

Crear archivo `.env.local` en la raíz del proyecto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Booking Secret (genera uno con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
BOOKING_SECRET=your_random_secret_key

# Resend (opcional, solo si usas confirmación por email)
RESEND_API_KEY=your_resend_api_key
```

4. **Configurar Supabase**

Ejecutar en el SQL Editor de Supabase:

```sql
-- Política RLS para permitir confirmación pública de reservas
CREATE POLICY "Allow public to confirm reservations"
ON reserva
FOR UPDATE
USING (true)
WITH CHECK (estado = 'confirmada');
```

5. **Configurar Storage en Supabase**

- Crear bucket `imgs` (público)
- Crear carpetas: `imgs/logo/` y `imgs/cortes/`
- Subir logos: `BLACK.png` y `WHITE.png` en `imgs/logo/`
- Subir imágenes de cortes: `cut1.png`, `cut2.png`, etc. en `imgs/cortes/`

## 🏃 Desarrollo

Iniciar el servidor de desarrollo:

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## 📦 Compilar para Producción

```bash
pnpm build
pnpm start
```

## 🌐 Despliegue

### Vercel (Recomendado)

1. Conectar repositorio en Vercel
2. Configurar variables de entorno (las mismas de `.env.local`)
3. Desplegar automáticamente

### Variables de Entorno en Producción

Asegúrate de configurar todas las variables de entorno en tu plataforma de hosting:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOOKING_SECRET`
- `RESEND_API_KEY`

## 📁 Estructura del Proyecto

```
├── app/                      # Páginas y rutas (App Router)
│   ├── agendar/             # Sistema de reservas
│   ├── dashboard/           # Panel administrativo
│   ├── api/                 # API routes
│   └── page.tsx             # Página principal
├── components/              # Componentes React
│   ├── booking/            # Componentes de reserva
│   ├── dashboard/          # Componentes del dashboard
│   └── ui/                 # Componentes shadcn/ui
├── lib/                     # Utilidades y servicios
│   └── services/           # Servicios de datos
├── utils/                   # Utilidades Supabase
│   └── supabase/           # Clientes Supabase
└── public/                  # Archivos estáticos
```

## 🔧 Configuración Adicional

### Edge Function (Email Confirmación)

Si necesitas emails de confirmación:

1. Instalar Supabase CLI
2. Desplegar función:
```bash
supabase functions deploy send-booking-email
```

3. Configurar secretos:
```bash
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set BOOKING_SECRET=your_secret
```

## 📝 Scripts Disponibles

- `pnpm dev` - Inicia servidor de desarrollo
- `pnpm build` - Compila para producción
- `pnpm start` - Inicia servidor de producción
- `pnpm lint` - Ejecuta linter

## 📄 Licencia

Este proyecto es privado y propietario.

## 👥 Contacto

Barbería BENJVMIN - [@benjvmin._](https://www.instagram.com/benjvmin._/)
