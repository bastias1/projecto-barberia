# Requerimientos — Plataforma SaaS de gestión de barberías

> Especificación funcional derivada del informe *"Proyecto de Título — Barbería (Formativa 2)"*.
> Fuente de verdad para Claude Code: historias de usuario, funciones del software y reglas de negocio.
> Las secciones marcadas **(sugerencia)** no vienen del informe; son propuestas de implementación.
> **El modelo de datos aún no está cerrado:** no se documenta aquí y puede cambiar. Los nombres de tablas y campos se definen al implementar.

---

## 1. Contexto del producto

- **Qué es:** plataforma web **SaaS multi-barbería (multi-tenant)** para barberías pequeñas (unipersonales o ≤ 5 trabajadores).
- **Problema:** reservas por WhatsApp/Instagram, inventario controlado "a ojo", cero registro histórico → decisiones por intuición.
- **Núcleo diferenciador:** módulo de **Business Intelligence** (dashboard de KPIs) + evaluación de **Machine Learning** (pronóstico de demanda). La reserva en línea y el e-commerce son los mecanismos de **captura del dato**.
- **Caso piloto:** barbería **Big Cut** (San José de la Mariquina, Región de Los Ríos). Servicios: corte, barba, cejas + venta de productos.
- **Modelo de negocio:** la barbería paga suscripción mensual (Básico / Pro / Premium); el cliente final usa la plataforma gratis.
- **Idioma / moneda / zona:** español de Chile, **CLP (enteros, sin decimales)**, zona horaria por defecto `America/Santiago`.

---

## 2. Stack tecnológico (definido en el informe)

| Capa | Tecnología |
|---|---|
| Frontend + lógica servidor | **Next.js (React) + TypeScript**, renderizado híbrido (SSR), rutas de API |
| Estilos | **Tailwind CSS**, mobile-first |
| Datos / Auth / Storage | **Supabase** (PostgreSQL + Supabase Auth + Storage), cliente `supabase-js` |
| Aislamiento multi-tenant | Identificador de barbería en cada registro de dominio + **RLS** |
| Gráficos BI | **Recharts**; agregaciones en **vistas SQL** (nunca en el navegador) |
| Pagos | **Mercado Pago** (pagos únicos + cobros recurrentes, webhooks). Respaldo: Flow |
| Correo | Servicio de correo transaccional (REST) |
| Calendario | **Google Calendar API** (OAuth 2.0), solo plan Premium |
| ML (offline) | Python: pandas, scikit-learn, statsmodels (Jupyter/Colab); la app solo lee las predicciones |
| Despliegue | **Vercel** (CD desde GitHub), entornos producción + staging |
| Pruebas | **Vitest** (unitarias), **Playwright** (E2E), **k6** (carga) |
| Metodología | Kanban (Trello) |

Fuera de alcance: app móvil nativa, multilenguaje/multimoneda, facturación electrónica SII, migración de datos de otros sistemas, personalización visual avanzada por barbería, ML productivo (solo evaluación de factibilidad).

---

## 3. Actores y roles

| Actor | Tipo | Descripción |
|---|---|---|
| **Cliente** | Primario | Reserva horas y compra productos. Puede reservar **con cuenta o como invitado**; para **comprar requiere cuenta**. |
| **Administrador de barbería** | Primario | Propietario o encargado de una barbería suscrita. Rol `propietario` o `administrador` dentro de su barbería. Un mismo usuario puede administrar más de una barbería. |
| **Administrador de plataforma** | Primario | Equipo proveedor: gestiona barberías suscritas y supervisa el servicio. |
| **Analista de datos (proveedor)** | Primario | Equipo proveedor: genera los pronósticos de demanda (CU-16). |
| Pasarela de pago | Secundario | Mercado Pago (webhooks) |
| Servicio de correo | Secundario | Envío de confirmaciones y alertas |
| Servicio de calendario | Secundario | Google Calendar |

---

## 4. Planes de suscripción (Anexo C)

La matriz de planes debe ser **configurable como datos**, **no hardcodeada** en el código.

| Funcionalidad (módulo) | Básico | Pro | Premium |
|---|:-:|:-:|:-:|
| Perfil público + catálogo de servicios (HU-01) | ✅ | ✅ | ✅ |
| Reservas 24/7, cuenta de cliente, agenda centralizada (HU-02, 03, 21, 22) — módulo `agenda` (base) | ✅ | ✅ | ✅ |
| Panel admin, horarios y profesionales (HU-04, 05) | ✅ | ✅ | ✅ |
| Confirmación automática por correo (HU-12) | ✅ | ✅ | ✅ |
| Mapa y ficha de contacto (HU-10) | ✅ | ✅ | ✅ |
| Catálogo de productos + carrito (HU-06, 07) — `ecommerce` | ❌ | ✅ | ✅ |
| Inventario y stock (HU-08) / alertas stock bajo (HU-09) | ❌ | ✅ | ✅ |
| Pago en línea (HU-23) | ❌ | ✅ | ✅ |
| Reseñas y calificaciones (HU-11) — incluidas en todos los planes (decisión del 2026-11-18; no hay módulo `resenas`) | ✅ | ✅ | ✅ |
| Dashboard BI: ingresos, ranking, demanda, histórico (HU-13..16) — `bi` | ❌ | ❌ | ✅ |
| Pronóstico de demanda (HU-25) — `pronostico` | ❌ | ❌ | ✅ |
| Sincronización Google Calendar (HU-24) — `calendario` | ❌ | ❌ | ✅ |
| Soporte por canal directo — `soporte_directo` | ❌ | ❌ | ✅ |
| **Límite de profesionales con agenda propia** | 1 | 3 | 5 |
| **Límite de sucursales** | 1 | 1 | 1 |

Reglas:
- `bi` y `pronostico` **no** se venden como módulo adicional.
- Precio del plan pendiente hasta definirse; **un plan no puede activarse sin precio**. (Referencia WTP: mediana ~$20.000 CLP/mes.)
- Sin límite de reservas mensuales en ningún plan; el escalamiento es por nº de profesionales.

---

## 5. Historias de usuario

Formato: **Como** rol, **quiero** …, **para** … · Prioridad MoSCoW · Puntos (Fibonacci) · CU relacionados · Plan mínimo.
Las condiciones de aceptación son los criterios de "hecho" — implementarlas como tests.

### 5.1 Reservas y agenda

#### HU-01 — Ver servicios y horarios · **Must** · 3 pts · CU-03 · Básico
**Como** cliente, **quiero** ver los servicios disponibles (corte, barba, cejas) y sus horarios, **para** elegir y agendar sin preguntar por WhatsApp.
- [ ] Lista servicios activos con nombre, **duración** y precio.
- [ ] Muestra el horario de atención de la barbería.

#### HU-02 — Reservar hora en línea · **Must** · 8 pts · CU-03, CU-04 · Básico
**Como** cliente, **quiero** reservar una hora seleccionando día y horario disponible, **para** no depender de coordinar por WhatsApp/Instagram.
- [ ] Solo se muestran horarios **libres** (sin reservas vigentes, dentro de franjas, fuera de días bloqueados).
- [ ] Se confirma la reserva (envía confirmación, HU-12).
- [ ] Se puede reservar **con cuenta** o **como invitado** (nombre + correo + aceptación de política de datos personales).
- [ ] El cliente elige profesional, fecha y hora; el profesional debe ofrecer el servicio.
- [ ] Si otro cliente tomó el horario en el intervalo → se informa y se refresca la disponibilidad.
- [ ] Si no hay horarios en la fecha → proponer la fecha disponible más próxima.
- **Depende de:** HU-21.

#### HU-03 — Agenda centralizada · **Must** · 5 pts · CU-06 · Básico
**Como** administrador de barbería, **quiero** visualizar en una agenda centralizada todas las reservas del día/semana, **para** dejar de recordar mentalmente los compromisos.
- [ ] Vista día y semana; cada reserva muestra cliente, servicio, profesional y horario.
- [ ] Marcar reserva como **completada** o **no asistida**.
- [ ] Registrar manualmente una cita recibida por otro canal (cliente registrado o invitado).
- [ ] Cada cambio de estado queda registrado con fecha y usuario que lo hizo.

#### HU-04 — Panel de administración protegido · **Must** · 5 pts · CU-01 · Básico
**Como** administrador de barbería, **quiero** acceder a un panel protegido con credenciales propias, **para** gestionar el negocio de forma segura y centralizada.
- [ ] Acceso con correo y contraseña; sin sesión válida no se entra al panel (redirige a login; API responde 401).
- [ ] Cada administrador **solo ve datos de su propia barbería** (RLS).

#### HU-05 — Profesionales, horarios y días bloqueados · **Must** · 3 pts · CU-07 · Básico
**Como** administrador de barbería, **quiero** registrar a los profesionales y actualizar sus horarios de atención y días bloqueados, **para** que la agenda online refleje la disponibilidad real.
- [ ] CRUD de profesionales (vinculables opcionalmente a una cuenta de usuario; ej. el dueño que también atiende).
- [ ] Definir franjas semanales de atención por profesional y sucursal; sin superposición.
- [ ] Asignar qué servicios ofrece cada profesional.
- [ ] Registrar días bloqueados (vacaciones, licencias, feriados).
- [ ] Cambios se reflejan **de inmediato** en la disponibilidad pública.
- [ ] Nº de profesionales activos ≤ límite del plan; si se supera, ofrecer cambio de plan.

#### HU-19 — Buscar y seleccionar barbería · **Must** · 5 pts · CU-02 · Básico
**Como** cliente, **quiero** buscar y seleccionar la barbería en que deseo reservar entre las registradas, **para** agendar en mi negocio de preferencia.
- [ ] Búsqueda por nombre o comuna; lista **solo barberías activas** (suspendidas no aparecen).
- [ ] Sin coincidencias → informar y mostrar barberías activas de la región.
- [ ] Al seleccionar, dirige al perfil/catálogo/agenda propia de la barbería (URL propia por barbería).

#### HU-21 — Cuenta de cliente · **Must** · 5 pts · CU-01 · Básico
**Como** cliente, **quiero** crear una cuenta e iniciar sesión con correo y contraseña, **para** reservar y comprar sin ingresar mis datos cada vez.
- [ ] Registro pide nombre, correo, contraseña y **exige aceptar la política de tratamiento de datos** (sin aceptación no se crea la cuenta).
- [ ] No se permite un correo ya registrado → informar y ofrecer recuperar contraseña.
- [ ] Comprar productos **requiere cuenta**; reservar puede hacerse como invitado.

#### HU-22 — Cancelar o reprogramar reserva · **Should** · 3 pts · CU-05 · Básico
**Como** cliente, **quiero** cancelar o reprogramar una reserva propia, **para** avisar con anticipación y liberar el horario.
- [ ] Solo dentro del plazo mínimo que define cada barbería (por defecto 2 h); fuera de plazo se rechaza e informa.
- [ ] El horario original queda libre.
- [ ] Se envía notificación del cambio.

#### HU-10 — Ubicación y cómo llegar · **Could** · 4 pts (agrupada con HU-16) · CU-03 · Básico
**Como** cliente, **quiero** ver la ubicación de la barbería, **para** llegar sin pedir indicaciones.
- [ ] Mapa interactivo con la ubicación del local + ficha de contacto.

#### HU-24 — Sincronizar con Google Calendar · **Could** · 5 pts · CU-08 · **Premium**
**Como** administrador de barbería, **quiero** sincronizar las reservas con mi Google Calendar, **para** ver mis citas en el calendario que uso a diario.
- [ ] Cada reserva confirmada se registra como evento en el calendario vinculado (OAuth 2.0; token guardado cifrado, fuera de las tablas).
- [ ] Si el servicio no responde, la reserva **sigue válida** y se reintenta la sincronización.

### 5.2 Comercio electrónico e inventario

#### HU-06 — Catálogo de productos · **Must** · (13 pts grupo HU-06..08) · CU-09 · Pro
**Como** cliente, **quiero** ver el catálogo de productos de cuidado personal, **para** conocer qué puedo comprar.
- [ ] Lista productos activos con nombre, descripción y precio (además de imagen y categoría).

#### HU-07 — Carrito de compra · **Must** · CU-09 · Pro
**Como** cliente, **quiero** agregar productos a un carrito, modificarlos o eliminarlos antes de confirmar, **para** armar mi compra cómodamente.
- [ ] Agregar, cambiar cantidades y eliminar productos.
- [ ] Si la cantidad supera el stock, ajustar a la cantidad disponible antes de confirmar.

#### HU-08 — Inventario y stock · **Must** · CU-11 · Pro
**Como** administrador de barbería, **quiero** registrar el inventario y su stock, **para** dejar de controlarlo visualmente.
- [ ] CRUD de productos (precio, stock, stock mínimo, imagen, activo).
- [ ] Registrar ingresos de stock; stock nunca negativo.

#### HU-09 — Alerta de stock bajo · **Should** · CU-12 · Pro
**Como** administrador de barbería, **quiero** recibir una alerta cuando un producto esté por agotarse, **para** reponer a tiempo.
- [ ] Si stock ≤ stock mínimo definido para ese producto → alerta en el panel **y** por correo.
- [ ] Productos inactivos no generan alerta.

#### HU-23 — Pagar productos en línea · **Must** · 13 pts · CU-09, CU-10 · Pro
**Como** cliente, **quiero** pagar en línea los productos de mi pedido, **para** no pagar en el local.
- [ ] Pago vía Mercado Pago; resultado recibido por **webhook**.
- [ ] **El stock se descuenta solo con pago aprobado.**
- [ ] Pago rechazado/expirado → pedido queda pendiente y se informa al usuario.
- [ ] Se guarda el identificador de la transacción de la pasarela; **nunca datos de tarjeta**.
- **Depende de:** HU-07.

### 5.3 Valoraciones y notificaciones

#### HU-11 — Reseñas y calificaciones · **Should** · CU-13 · Básico (todos los planes)
**Como** cliente, **quiero** ver reseñas de la barbería y dejar la mía al terminar un servicio o compra, **para** elegir con confianza y opinar.
- [ ] Requiere cita completada o producto entregado, y ser su autor.
- [ ] Calificación 1–5 estrellas + texto; **una sola vez** por cita o por producto comprado.
- [ ] Invitados solo reseñan servicios.
- [ ] Se recalcula el promedio de la barbería.

#### HU-12 — Confirmación de reserva o pedido · **Should** · CU-04, CU-20 · Básico
**Como** cliente, **quiero** recibir confirmación de mi reserva o pedido, **para** tener certeza de que quedó registrada.
- [ ] Correo con el detalle correspondiente.
- [ ] Si el envío falla: reintentar y registrar el error; la reserva sigue confirmada.

### 5.4 Business Intelligence y ML (Premium)

#### HU-13 — Dashboard de ingresos · **Must** · (13 pts grupo HU-13..14) · CU-14
**Como** administrador de barbería, **quiero** un dashboard con ingresos diarios, semanales y mensuales, **para** saber cuánto genera el negocio.
- [ ] Ingresos por día/semana/mes del período elegido (servicios completados + pedidos pagados).
- [ ] Carga en **< 5 s** (p95).

#### HU-14 — Ranking de servicios y productos · **Must** · CU-14
**Como** administrador de barbería, **quiero** ver los servicios y productos más solicitados/vendidos, **para** saber qué impulsar.
- [ ] Ranking por citas completadas y unidades vendidas en el período.

#### HU-15 — Demanda por día de la semana · **Should** · CU-14
**Como** administrador de barbería, **quiero** ver qué días tienen mayor y menor demanda, **para** planificar horarios y promociones.
- [ ] Citas por día de la semana (y franja horaria); identifica día de mayor y menor demanda.

#### HU-16 — Histórico por rango de fechas · **Could** · CU-14
**Como** administrador de barbería, **quiero** ver el comportamiento histórico en un rango de fechas, **para** decidir por tendencias y no por intuición.
- [ ] Elige fecha inicio y término; **todos** los indicadores se recalculan.
- [ ] Si no hay datos suficientes, cada gráfico lo indica (sin errores).

#### HU-25 — Pronóstico de demanda · **Could** · 13 pts · CU-15, CU-16
**Como** administrador de barbería, **quiero** consultar el pronóstico de demanda de citas y productos de las próximas semanas, **para** anticipar agenda y reposición.
- [ ] Muestra demanda estimada por fecha con margen de error.
- [ ] Solo se publica si **MAPE < 20 %** (KPI-S3).
- [ ] Sin historial suficiente → "pronóstico aún no disponible".
- Nota: el entrenamiento es **offline** (Python, analista); la app solo **lee** las predicciones publicadas.

### 5.5 SaaS: barberías y suscripciones

#### HU-17 — Registrar barbería · **Must** · 13 pts · CU-17
**Como** administrador de barbería, **quiero** registrarme y crear el perfil de mi negocio, **para** operar como negocio nuevo aislado de los demás.
- [ ] Crea un identificador único de barbería y aísla sus datos con **RLS**.
- [ ] Quien registra la barbería queda como propietario.
- [ ] Registra los datos del local (dirección, comuna, región, ubicación en mapa, zona horaria).

#### HU-18 — Planes de suscripción · **Must** · 8 pts · CU-17, CU-10
**Como** administrador de barbería, **quiero** elegir un plan (Básico, Pro, Premium) al registrarme o cambiarlo luego, **para** acceder a las funciones del plan.
- [ ] Acceso a módulos restringido según plan activo (ej. BI solo Premium) — en UI **y** en BD.
- [ ] Cobro recurrente por pasarela; si falla, la barbería queda **inactiva** hasta regularizar.
- [ ] Solo una suscripción vigente por barbería; se conserva el historial de planes y pagos.
- [ ] No se puede contratar BI como módulo adicional.

#### HU-20 — Panel de plataforma · **Should** · CU-18, CU-19
**Como** administrador de plataforma, **quiero** ver y gestionar las barberías suscritas, su estado de pago e indicadores globales, **para** administrar la plataforma y dar soporte.
- [ ] Listado de barberías con plan contratado y estado de pago; morosas destacadas.
- [ ] Suspender / reactivar barberías (suspendida no aparece en búsquedas).
- [ ] Indicadores globales (KPI-08: barberías activas).
- [ ] Un admin de barbería **no** puede acceder a este panel.

---

## 6. Orden de implementación (WSJF del informe)

| Orden | Historia(s) | MoSCoW | Pts | WSJF |
|:-:|---|:-:|:-:|:-:|
| 1 | HU-01 | Must | 3 | 4,00 |
| 2 | HU-05 | Must | 3 | 3,67 |
| 3 | HU-04 | Must | 5 | 3,20 |
| 4 | HU-21 | Must | 5 | 3,00 |
| 5 | HU-03 | Must | 5 | 2,40 |
| 6 | HU-19 | Must | 5 | 2,40 |
| 7 | HU-18 | Must | 8 | 1,88 |
| 8 | HU-02 | Must | 8 | 1,75 |
| 9 | HU-17 | Must | 13 | 1,38 |
| 10 | HU-13, HU-14 | Must | 13 | 1,08 |
| 11 | HU-23 | Must | 13 | 0,92 |
| 12 | HU-06, HU-07, HU-08 | Must | 13 | 0,85 |
| 13 | HU-22 | Should | 3 | 3,00 |
| 14 | HU-09, HU-11, HU-12, HU-15, HU-20 | Should | 21 | 0,48 |
| 15 | HU-24 | Could | 5 | 1,40 |
| 16 | HU-10, HU-16 | Could | 8 | 0,88 |
| 17 | HU-25 | Could | 13 | 0,69 |

**Regla:** una historia no se inicia antes de su dependencia (HU-02 ← HU-21; HU-23 ← HU-07).
**Bloques:** (1) núcleo de reservas y acceso HU-01..05, HU-21 + multi-tenant HU-17..19 → (2) BI y e-commerce HU-13, 14, 23, 06..08 → (3) Should/Could.

> **(sugerencia)** En la práctica, el aislamiento multi-tenant (identificador de barbería + RLS) conviene establecerlo **desde la primera migración**, aunque la UI de alta de barberías (HU-17) llegue en el orden 9; así no hay que retrofitear RLS.

---

## 7. Funciones del software por módulo

Componentes definidos en el informe (diagrama de componentes) y lo que debe hacer cada uno.

### 7.1 Portal del cliente (público)
- Búsqueda de barberías por nombre/comuna (solo activas).
- Perfil público de barbería: servicios, profesionales, mapa, calificación promedio, reseñas.
- Consulta de disponibilidad por servicio/profesional/fecha.
- Flujo de reserva (con cuenta o invitado + consentimiento).
- Mis reservas: ver, cancelar, reprogramar.
- Catálogo de productos, carrito, checkout (retiro o despacho), pago Mercado Pago.
- Mis pedidos (estado logístico y de pago); direcciones de despacho (una predeterminada).
- Publicar reseñas.
- Registro / login / recuperación de contraseña; solicitud de supresión de datos.

### 7.2 Panel de administración de barbería
- Agenda día/semana por profesional; marcar completada / no asistida; crear cita manual.
- Profesionales, servicios, servicios por profesional, franjas de atención, días bloqueados.
- Configuración del negocio: datos, local, plazo de cancelación, tolerancia de inasistencia, correo de contacto (recibe alertas).
- Productos e inventario; alertas de stock bajo en el panel.
- Pedidos: gestionar estado logístico (en preparación, listo para retiro, enviado, entregado, cancelado).
- Suscripción: ver plan, cambiar plan, estado de pago.
- Vincular Google Calendar (Premium).

### 7.3 Dashboard de BI (Premium)
- Selector de período (día/semana/mes) y rango de fechas.
- KPI-01 a KPI-07 (ver §9) con gráficos Recharts.
- Sección de pronóstico de demanda (HU-25).
- Estado "sin datos suficientes" por gráfico.

### 7.4 Panel de plataforma (administrador de plataforma)
- Listado de barberías, plan, estado de suscripción/pago, morosas destacadas.
- Suspender / reactivar / editar barberías.
- KPI-08 e indicadores globales.

### 7.5 APIs / servicios de backend
| Servicio | Responsabilidad |
|---|---|
| API de catálogo e inventario | Servicios, productos, stock |
| API de reservas | Cálculo de disponibilidad, registro, cancelación, reprogramación |
| API de pedidos | Registro de pedidos, actualización de inventario |
| API de suscripciones | Alta de barberías, cambio de plan, estado de pago |
| Servicio de pagos | Crear cobros en Mercado Pago, **recibir webhooks** (validar firma, idempotencia por id de transacción) |
| Servicio de notificaciones | Componer y enviar correos; reintentos; registro de envíos |
| Servicio de analítica | Consultar vistas analíticas para el dashboard |

### 7.6 Procesos automáticos
- Pasada la hora de término de la cita más la tolerancia de inasistencia (por defecto 15 min) sin marcar asistencia → registrar como no asistida (temporizador del BPMN TO-BE). **(sugerencia:** cron de Vercel o `pg_cron`).
- Reintento de notificaciones fallidas y de sincronización de calendario.
- Cobro recurrente de suscripciones; morosidad → barbería inactiva.

---

## 8. Reglas de negocio (aplicarlas en la BD, no solo en la app)

| Origen | Regla |
|---|---|
| RNF-07 | Una barbería no puede ver ni referenciar datos de otra (RLS + referencias que incluyan la barbería). |
| HU-02 | Un profesional no puede tener dos reservas vigentes superpuestas. |
| HU-01, HU-05 | Solo se reserva dentro de las franjas del profesional, fuera de sus días bloqueados y en servicios que ofrece. La hora de término se calcula con la duración del servicio. |
| HU-05 | Las franjas de atención de un mismo profesional no se superponen. |
| HU-22 | El cliente cancela o reprograma solo dentro del plazo definido por la barbería. |
| HU-05, HU-18 | Los profesionales y sucursales activas no superan el límite del plan. |
| HU-18 | Cada funcionalidad opera solo si el plan la incluye (también las vistas de BI). |
| HU-18 | El pago aprobado activa la suscripción y la barbería; el fallido la deja inactiva. |
| HU-23, HU-09 | El stock se descuenta solo con el pago aprobado y se avisa cuando queda bajo el mínimo. |
| HU-11 | Solo se reseña una cita completada o un producto entregado, una vez y por su propio autor. |
| HU-02, HU-21 | Cada reserva, reseña y consentimiento pertenece a un único titular: usuario con cuenta **o** invitado. |
| RNF-10 | Todo cambio de estado de una reserva queda registrado (fecha y usuario). |
| Ley 21.719 | El consentimiento no se modifica ni elimina; su retiro es un registro nuevo (tipo, versión de política, fecha, origen). |
| Ley 21.719 | El titular puede pedir la supresión de sus datos: se anonimizan sus datos de identificación y se conservan sus transacciones, sin alterar los indicadores. |
| PCI DSS | La plataforma no guarda datos de tarjeta; solo el identificador de la transacción y la respuesta de la pasarela. |
| BI | El precio de la reserva, el precio unitario de cada producto vendido, el precio pactado de la suscripción y la dirección de envío se guardan con el valor **vigente al momento** de la transacción. |
| BI | El pedido separa estado logístico y estado de pago; los ingresos solo consideran pedidos pagados. |

Estados de negocio definidos en el informe (los nombres finales se fijarán con el modelo de datos):
- **Reserva:** pendiente, confirmada, completada, cancelada, no asistió.
- **Pedido (logístico):** pendiente, en preparación, listo para retiro, enviado, entregado, cancelado.
- **Pedido (pago):** pendiente, pagado, rechazado, reembolsado.
- **Suscripción:** pendiente, activa, morosa, suspendida, cancelada.
- **Pago:** pendiente, aprobado, rechazado, expirado, reembolsado.

---

## 9. KPIs del módulo de BI

Se calculan en **vistas SQL** que respetan RLS y solo devuelven datos si el plan incluye `bi`. Todas deben permitir filtrar por rango de fechas (HU-16).

| KPI | Cálculo |
|---|---|
| KPI-01 Ingresos por período | Suma de reservas completadas + pedidos pagados, por día/semana/mes, separada en servicios y productos |
| KPI-02 Servicios realizados | Conteo e ingresos de reservas completadas por servicio y día |
| KPI-03 Productos vendidos | Unidades y montos por producto (solo pedidos pagados) |
| KPI-04 Demanda por día | Reservas no canceladas por día de semana y franja horaria, en hora local del local |
| KPI-05 Ocupación de agenda | Minutos reservados / minutos de atención publicados, por profesional y día, sin días bloqueados |
| KPI-06 Ticket promedio | Ingresos del mes / nº de transacciones |
| KPI-07 Inasistencia (no-show) | No asistidas / (completadas + no asistidas), mensual; excluye canceladas |
| KPI-08 Barberías activas | Suscripción vigente + actividad en últimos 30 días. **Solo administrador de plataforma** |
| KPI-S3 Pronóstico | Solo se publican predicciones con MAPE < 20 % |
| Calificación (CU-13) | Promedio y nº de reseñas por barbería (público) |

---

## 10. Requisitos no funcionales

| ID | Requisito | Cómo cumplirlo |
|---|---|---|
| RNF-01 | Usabilidad simple para cliente y dueño sin personal de apoyo | UI simple, prototipos validados con Big Cut |
| RNF-02 | Disponibilidad 24/7 (meta 99 % mensual) | Vercel + Supabase gestionados |
| RNF-03 | Responsivo / mobile-first | Tailwind; flujo de reserva sin scroll horizontal en móvil y desktop |
| RNF-04 | Protección de datos (Ley 19.628 mod. por Ley 21.719) | Supabase Auth, HTTPS/TLS, RLS, consentimiento registrado, anonimización |
| RNF-05 | Escalabilidad en historial y nº de barberías | Servicios gestionados; índices por barbería y fecha |
| RNF-06 | Catálogo/agenda **< 3 s**; dashboard **< 5 s** (p95) | SSR + CDN; agregaciones en vistas SQL |
| RNF-07 | Aislamiento lógico entre barberías | Identificador de barbería + RLS. **Cero accesos cruzados** |
| RNF-08 | Ciclo de vida de suscripciones (alta, cambio, suspensión por impago) | Cobros recurrentes Mercado Pago + estado de pago por barbería |
| RNF-09 | Mantenibilidad | Repo único en GitHub, CD en Vercel, staging + producción |
| RNF-10 | Trazabilidad | Marca temporal + identificador de barbería en toda transacción; historial de estados de reserva |

SLA adicionales: respaldo diario (RPO 24 h, RTO 24 h hábiles); soporte 24 h hábiles críticas / 72 h no críticas.

---

## 11. Casos de prueba clave (Definition of Done)

Implementar como tests (Vitest/Playwright/SQL). El informe define 53 casos; los críticos:

- **CP-01** Reserva + segunda reserva simultánea al mismo horario → la segunda es rechazada.
- **CP-02 / CP-51** Barbería A no puede leer ni referenciar datos de la barbería B.
- **CP-03** Compra que deja stock bajo el mínimo → pedido pagado, stock descontado, alerta emitida.
- **CP-04** Dashboard mensual sobre 6 meses de datos < 5 s (p95).
- **CP-06/07** Registro con correo duplicado o sin aceptar política → no crea cuenta.
- **CP-08** Barbería suspendida no aparece en la búsqueda.
- **CP-10** Disponibilidad excluye horarios reservados, días bloqueados y fuera de franja.
- **CP-14** Reprogramación fuera de plazo → rechazada; la reserva original se mantiene.
- **CP-18 / CP-48** Superar límite de profesionales/sucursales del plan → rechazado.
- **CP-22** Pago rechazado → pedido pendiente, stock **no** se descuenta.
- **CP-26 / CP-49** Reseña duplicada o de algo no completado/no comprado → rechazada.
- **CP-29** Plan sin BI no accede al dashboard.
- **CP-34** Pago de suscripción fallido → barbería registrada pero inactiva.
- **CP-36 / CP-39** Rutas protegidas por rol y sesión.
- **CP-50** No se puede contratar BI como addon sobre Básico.
- **CP-52 / CP-53** Consentimiento inmutable; supresión anonimiza sin cambiar KPIs.

---

## 12. Instrucciones para Claude Code

1. **El modelo de datos no está cerrado.** Antes de crear o modificar tablas, proponer el esquema y pedir confirmación; no asumir nombres de tablas o campos.
2. Todo dato de dominio debe quedar asociado a su barbería y protegido con RLS. Nunca depender del filtro del frontend para aislar barberías.
3. Las reglas de §8 van **en la base de datos** (constraints, triggers); la app solo las refleja en la UI.
4. Los permisos por plan (módulos y límites) se leen desde datos configurables; **no** hardcodear la matriz de §4.
5. Montos en CLP como enteros. Guardar precios históricos en la transacción.
6. Fechas con zona horaria; mostrar en la zona horaria del local.
7. Pagos: confiar solo en el **webhook** de Mercado Pago para cambiar estados; nunca en el redirect del cliente. Nunca persistir datos de tarjeta.
8. Secretos (tokens de Google, claves de Mercado Pago) fuera de las tablas (Supabase Vault / variables de entorno).
9. Cada nueva historia se cierra con sus condiciones de aceptación (§5) cubiertas por tests.
10. Migraciones SQL versionadas en el repo (`supabase/migrations`); probar primero en local/staging.
11. Al implementar una HU, referenciar su ID (ej. `feat(HU-02): ...`) en commits y PRs.

---

## 13. Estado de implementación (revisado 2026-10-27)

✅ hecha · 🟡 parcial · ❌ no iniciada. Revisado contra el código y la BD (`jrffkkktryskigbglpit`); no hay tests que lo respalden.

| HU | Estado | Qué hay | Qué falta |
|---|:-:|---|---|
| HU-01 | ✅ | Servicios con duración y precio (`service-selection`), horario resumido en la página pública (`getHorarioResumen`) | — |
| HU-02 | ✅ | Solo horarios libres (`horarios_ocupados`, `dias_bloqueados`), validación en trigger `validar_reserva`, invitado + consentimiento (`reservar_como_invitado`), correo de confirmación; con sesión se reserva **con cuenta** (RPC `reservar_con_cuenta`, `reserva.id_cliente`) o se elige usar otros datos; si otro cliente tomó la hora (23P01) se informa, se vuelve al paso de fecha y se recarga la disponibilidad; un día sin horarios propone la fecha libre más próxima (hasta 30 días, `getProximaFechaDisponible`) | La búsqueda de la fecha más próxima consulta día por día |
| HU-03 | ✅ | Agenda día/semana/mes (`dashboard/citas?vista=dia\|semana\|mes`), marcar completada / no asistió, cita manual, historial con usuario (`reserva_historial.cambiado_por`) | La agenda es la del barbero con sesión ("Mis Citas"): el admin no tiene una agenda de todos los profesionales |
| HU-04 | ✅ | Login, `requireStaff`, RLS por barbería, API responde 401 | — |
| HU-05 | 🟡 | Horarios por sucursal sin superposición, días bloqueados, servicios por profesional, límite de profesionales en BD (trigger + invitaciones) | Profesional **sin cuenta** (hoy solo entra por invitación); ofrecer cambio de plan al llegar al límite (solo se muestra el cupo) |
| HU-19 | ✅ | `/barberias`: búsqueda por nombre o comuna (sin tildes ni mayúsculas) y filtro de región, solo barberías activas; sin coincidencias avisa y muestra las activas de la región elegida (todas si no se eligió); cada resultado lleva a `/[slug]` | La "región" del fallback es la que elige la persona en el filtro (la spec no dice de dónde sale); sucursales sin `region` cargada no entran en ese filtro |
| HU-21 | ✅ | Signup con nombre, correo y contraseña; checkbox obligatorio de términos y privacidad (sin aceptarlo el trigger `crear_perfil_usuario` rechaza la cuenta y registra `consentimiento`); correo ya registrado → aviso con link al login para entrar o recuperar la contraseña; login simplificado; comprar exige sesión | El aviso de correo registrado depende de que Supabase devuelva un usuario sin identidades (no se probó contra Supabase) |
| HU-22 | ✅ | Cancelar y **reprogramar** (misma barbería, barbero y servicio; nueva fecha y hora) con cuenta ("Mis Reservas" en el perfil) o con el link firmado del correo (`/[slug]/reprogramar`); plazo mínimo por barbería (`barberia.plazo_cancelacion_min`, 2 h por defecto, editable en Mi Barbería) aplicado en la BD (RPC `cambiar_reserva_cliente` y trigger); fuera de plazo se rechaza e informa; correo al cliente con el cambio; aviso en tiempo real al barbero | El barbero no recibe correo (solo el aviso en el panel); reprogramar no queda en `reserva_historial` (solo registra cambios de estado) |
| HU-10 | ✅ | Mapa embebido + ficha de contacto en la home y en `/[slug]/[sucursal]` | — |
| HU-24 | ❌ | — | Integración Google Calendar (OAuth, token en Vault, reintentos) |
| HU-06 | ✅ | Catálogo con nombre, descripción, precio, imagen, categoría (`/tienda`) | — |
| HU-07 | ✅ | Carrito con cantidades limitadas al stock; el pedido se cancela si el stock falla | — |
| HU-08 | ✅ | CRUD de productos (precio, stock, stock mínimo, imagen, activo); "Registrar ingreso" (RPC `ingresar_stock`); todo cambio de stock queda en `movimiento_stock` | Pantalla con el historial de movimientos (no la pide la HU) |
| HU-09 | ✅ | Aviso en Productos y correo a los administradores cuando un pago deja un producto en o bajo su mínimo (un correo por baja, `producto.alerta_stock_at`); los archivados no alertan | — |
| HU-23 | 🟡 | Pago con tarjeta (Orders API), webhook con firma, se guarda el id de transacción, nunca la tarjeta, rechazo deja el pedido pendiente; el stock se descuenta **solo con pago aprobado** (`pedido.stock_descontado`) | El resultado síncrono de Mercado Pago también cambia el estado, no solo el webhook (ver divergencia en CLAUDE.md) |
| HU-11 | ✅ | Reglas en BD (`validar_resena`: cita completada / producto entregado, una vez, invitados solo servicios), carrusel público, rating por producto, link de reseña por correo; promedio y nº de reseñas de la barbería en su página (RPC `resumen_resenas`, siempre al día porque se calcula al consultar); disponible en todos los planes | — |
| HU-12 | 🟡 | Correos de reserva, pedido entregado e invitación (Resend) | Reintento de envíos fallidos y registro de envíos (hoy solo `console.error`) |
| HU-13 | 🟡 | `/[slug]/dashboard/estadisticas` (solo admin con `bi`): ingresos por día/semana/mes (servicios completados + pedidos pagados) con funciones SQL `bi_*` (`BI.sql`) | Medir <5 s p95 (CP-04); pruebas de CP-29/CP-50 |
| HU-14 | ✅ | Ranking de servicios (citas completadas) y productos (unidades en pedidos pagados) | — |
| HU-15 | ✅ | Demanda por día de semana y hora local, con el día de mayor y menor demanda | — |
| HU-16 | 🟡 | Rango de fechas (más atajos 7 d/30 d/6 m) que recalcula todos los indicadores; cada gráfico muestra "sin datos suficientes" | Estado vacío propio en las tarjetas KPI y la tabla mensual; el rango se recorta a 2 años con aviso |
| HU-25 | 🟡 | Tabla `prediccion_demanda` (con datos) y trigger que exige `bi` | Pantalla que la muestre con margen de error; filtro MAPE < 20 %; estado "aún no disponible" |
| HU-17 | ✅ | `/registro` (RPC `registrar_barberia`): quien registra queda admin, primera sucursal con dirección, comuna, región y zona horaria; RLS | — |
| HU-18 | 🟡 | Planes como datos, módulos restringidos en UI y BD, cobro recurrente (preapproval MP), historial de pagos, BI no se vende suelto | Un cobro fallido no inactiva al tiro: la barbería vence en `fecha_termino` (+5 días de gracia). Los límites cargados no coinciden con §4 (hoy Básico 2 prof., Pro 5 prof./2 suc.) |
| HU-20 | ✅ | `/admin`: barberías con plan y estado, filtro de vencidas, suspender/reactivar, MRR, bitácora; solo superadmin | KPI-08 con actividad de los últimos 30 días (hoy cuenta por estado de suscripción) |

Fuera de las HU:
- §7.6 procesos automáticos: no hay `pg_cron` ni cron de Vercel → no existe el paso automático a "no asistió" ni reintentos.
- §9 KPIs: KPI-01..07 están en funciones SQL con parámetros `bi_*` (no vistas, porque necesitan rango de fechas), solo para admin con `bi`. Parciales: KPI-02 y KPI-05 no traen el desglose por día (KPI-05 va por profesional sobre el rango y se topa en 100 %); la fecha de un pedido pagado es la de su primer pago aprobado (la spec no la define). KPI-08 sigue en `/admin`.
- Ley 21.719: existen `consentimiento` y las funciones `anonimizar_usuario` / `anonimizar_guest`, pero no hay flujo para que el titular pida la supresión.
- §11: no hay suite de tests.

Cambios pedidos que aún no están en la spec:
- **Comprar como invitado** (pedido el 2026-11-15, sin HU todavía): pagar un pedido sin cuenta, completando en el checkout todos los datos necesarios (contacto, entrega y dirección, aceptación de la política) en un formulario de una sola página, al estilo del checkout de Shop. **Contradice** la regla actual "comprar requiere cuenta" (§3 actores y HU-21), que habría que cambiar. Implica cambios de esquema: hoy `pedido.id_cliente` NULL significa venta presencial, así que falta `pedido.id_guest` (titular único: cuenta **o** invitado, como en `reserva`), una RPC para crear el pedido sin sesión (como `reservar_como_invitado`), el consentimiento del invitado, el seguimiento del pedido por link firmado en el correo (no hay perfil) y que `/api/checkout` y `/api/checkout/pagar` dejen de exigir sesión. Los invitados seguirían sin poder reseñar productos (HU-11).

Siguiente bloque sugerido (orden WSJF, §6): HU-21 y HU-02 (reservar con cuenta), luego HU-22, HU-09 y HU-12. HU-25 (pronóstico) queda para una fase aparte.
