# Glossary

Domain terms used in the code. Names stay in Spanish where the code uses them.

**Membresía** (`Membresia`, table `usuario_barberia`): a user's role in one barbería (`admin`, `profesional` or `cliente`). One user can hold several, one per barbería. Only active memberships of active barberías count.

**Superadmin**: platform administrator (`usuario.rol = 'superadmin'`). Global, not tied to a barbería; reaches `/admin`.

**Acceso** (`Acceso`, `lib/acceso.ts`): the answer to "who is this signed-in user and where do they go": `{ esSuperadmin, membresias, destino }`. Resolved in one place by `resolverAcceso()`; callers never assemble it themselves.

**Destino**: the path a user lands on after signing in. Rules, in order: a safe internal `?next=`; else with an origin barbería, its dashboard for its staff and its public page for everyone else; else `/admin` for a superadmin, the dashboard for staff of exactly one barbería, and `/cuenta` for the rest.

**Personal** (staff): `admin` or `profesional` members of a barbería. A superadmin is staff everywhere (see `getRolApp` in `lib/roles.ts`).

**Suscripción** (`suscripcion`, `lib/suscripcion.ts`): a barbería's contract with a plan. The current one is the most recent row (`ultimaSuscripcion`); callers never query it themselves.

**Vigencia**: a suscripción is in force while its `estado` is `prueba` or `activa` and `fecha_termino` is null or not past. "Today" is the `America/Santiago` date (`DEFAULT_TZ`), not UTC. `estadoSuscripcion()` is the only TypeScript rule; the DB enforces the same one on modules.

**Gracia** (`DIAS_GRACIA`, 5): extra days of vigencia after each approved charge, in case the next one is late.

**Cortesía**: active suscripción with no Mercado Pago charge, granted by a superadmin. Cannot be set while a renovación automática exists.

**Renovación automática**: the suscripción's Mercado Pago preapproval (`id_suscripcion_externa`). Cancelling it, by the owner or by webhook, is one transition: the suscripción stays in force until `fecha_termino` and the owner is told once.

**Apariencia**: how a barbería's public pages look, as chosen by its admin: Secciones, Modo, Tema and Diseño.

**Sección**: one block of the barbería's home page that can be shown, hidden and reordered. The encabezado (header) is not one: it is always first.

**Modo**: light, dark or automatic (follows the visitor's device). Not part of the Tema.

**Tema**: colors, font and card style of the barbería's public pages.

**Diseño**: how the home page arranges the encabezado and the Secciones. A foto de portada is the banner of one of the diseños.
