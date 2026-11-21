import { afterAll, describe, expect, it } from "vitest";
import { admin } from "./helpers/supabase";

// crear_perfil_usuario: una cuenta OAuth (Google) entra sin consentimiento y lo acepta después en /cuenta/terminos;
// una cuenta con correo y clave sigue necesitando acepta_terminos.
const creados: string[] = [];
afterAll(async () => {
  // consentimiento es inmutable: solo se borran las cuentas que no lo tienen
  for (const id of creados) await admin.auth.admin.deleteUser(id).catch(() => {});
});

// shortcut: el admin API siempre crea con provider 'email', así que el camino Google se probó con SQL directo
// sobre auth.users (perfil Ana|Pérez, 0 consentimientos); pasar a un test e2e si se agrega Playwright.
describe("crear_perfil_usuario", () => {
  it("sigue rechazando una cuenta con correo y clave sin aceptar los términos", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `sin-terminos-${Date.now()}@pruebas.navaja.test`, password: "Prueba-1234!", email_confirm: true,
    });
    if (data.user) creados.push(data.user.id);
    expect(error).not.toBeNull();
  });
});
