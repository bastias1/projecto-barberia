# Glossary

Domain terms used in the code. Names stay in Spanish where the code uses them.

**Membresía** (`Membresia`, table `usuario_barberia`): a user's role in one barbería (`admin`, `profesional` or `cliente`). One user can hold several, one per barbería. Only active memberships of active barberías count.

**Superadmin**: platform administrator (`usuario.rol = 'superadmin'`). Global, not tied to a barbería; reaches `/admin`.

**Acceso** (`Acceso`, `lib/acceso.ts`): the answer to "who is this signed-in user and where do they go": `{ esSuperadmin, membresias, destino }`. Resolved in one place by `resolverAcceso()`; callers never assemble it themselves.

**Destino**: the path a user lands on after signing in. Rules, in order: a safe internal `?next=`; else with an origin barbería, its dashboard for its staff and its public page for everyone else; else `/admin` for a superadmin, the dashboard for staff of exactly one barbería, and `/cuenta` for the rest.

**Personal** (staff): `admin` or `profesional` members of a barbería. A superadmin is staff everywhere (see `getRolApp` in `lib/roles.ts`).
