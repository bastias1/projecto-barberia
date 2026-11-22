import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/notifications", () => ({ notificarStockBajo: vi.fn() }));

import { sumarMes } from "../lib/suscripcion";

describe("sumarMes", () => {
  it("no se pasa al mes siguiente a fin de mes", () => {
    expect(sumarMes("2026-01-31")).toBe("2026-02-28");
    expect(sumarMes("2028-01-31")).toBe("2028-02-29");
    expect(sumarMes("2026-03-31")).toBe("2026-04-30");
  });
  it("conserva el día cuando existe y cruza el año", () => {
    expect(sumarMes("2026-10-20")).toBe("2026-11-20");
    expect(sumarMes("2026-12-15")).toBe("2027-01-15");
  });
});
