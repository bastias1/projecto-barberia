import { beforeAll, describe, expect, it } from "vitest";
import { crearState, leerState, urlAutorizacion } from "../lib/google-calendar-oauth";

// HU-24 (T2): state firmado del OAuth y URL de autorización de Google (sin BD)
beforeAll(() => {
  process.env.BOOKING_SECRET = "secreto-de-prueba";
  process.env.GOOGLE_CLIENT_ID = "cliente.apps.googleusercontent.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://navaja.test/";
});

const USER = "8f0c2a1e-1111-4222-8333-944455556666";
const T0 = Date.UTC(2026, 10, 19, 12);

describe("state del OAuth", () => {
  it("devuelve el usuario y la barbería que lo firmaron", () => {
    expect(leerState(crearState(USER, "benjvmin", T0), T0 + 60_000)).toEqual({ userId: USER, slug: "benjvmin" });
  });

  it("vence a los 10 minutos", () => {
    const state = crearState(USER, "benjvmin", T0);
    expect(leerState(state, T0 + 9 * 60_000)).not.toBeNull();
    expect(leerState(state, T0 + 11 * 60_000)).toBeNull();
  });

  it("rechaza un state alterado o basura", () => {
    const state = crearState(USER, "benjvmin", T0);
    expect(leerState(state.replace("benjvmin", "otra"), T0)).toBeNull();
    expect(leerState(state.replace(/\.(\d+)\./, (_, n) => `.${Number(n) + 3_600_000}.`), T0)).toBeNull();
    expect(leerState("", T0)).toBeNull();
    expect(leerState(null, T0)).toBeNull();
    expect(leerState("a.b.c", T0)).toBeNull();
  });
});

describe("urlAutorizacion", () => {
  it("pide acceso offline a los eventos y al correo, con nuestro callback", () => {
    const url = new URL(urlAutorizacion("el-state"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe("cliente.apps.googleusercontent.com");
    expect(p.get("redirect_uri")).toBe("https://navaja.test/api/google-calendar/callback");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("scope")?.split(" ").sort()).toEqual(
      ["email", "https://www.googleapis.com/auth/calendar.events", "openid"]);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("state")).toBe("el-state");
    expect(p.has("login_hint")).toBe(false);
  });

  it("propone la cuenta de la sesión con login_hint", () => {
    expect(new URL(urlAutorizacion("s", "benja@gmail.com")).searchParams.get("login_hint")).toBe("benja@gmail.com");
  });
});
