import { describe, expect, it } from "vitest";
import { armarOrden, descriptorDe } from "../lib/orden-mp";

// Cuerpo de la order de la tienda (lib/orden-mp.ts): ítems, comprador y descriptor. Sin red.
const base = {
  idPedido: 7, monto: "25000", barberia: "Barbería BENJVMIN", email: "cliente@correo.cl",
  comprador: { nombre: "Ana", apellido: "Pérez", registradoEn: "2026-01-02T03:04:05.000Z" },
  items: [{ idProducto: 3, nombre: "Cera", cantidad: 2, precioUnitario: 12500 }],
  pago: { metodoId: "master", tipo: "credit_card", token: "tok" },
};

type Detalle = {
  payer: Record<string, unknown>;
  transactions: { payments: { payment_method: Record<string, unknown> }[] };
  additional_info: Record<string, unknown>;
};

describe("descriptorDe", () => {
  it("mayúsculas, sin tildes ni símbolos", () => expect(descriptorDe("Barbería BENJVMIN")).toBe("BARBERIA BENJVMIN"));
  it("corta en 22 y no deja espacio al final", () => {
    const d = descriptorDe("Barbería Los Ríos del Sur de Chile");
    expect(d.length).toBeLessThanOrEqual(22);
    expect(d).toBe(d.trim());
  });
  it("un nombre sin letras ni números queda vacío", () => expect(descriptorDe("***")).toBe(""));
});

describe("armarOrden", () => {
  it("mantiene los campos de siempre", () => {
    expect(armarOrden(base)).toMatchObject({
      type: "online", processing_mode: "automatic", external_reference: "7", total_amount: "25000",
      transactions: { payments: [{ amount: "25000", payment_method: { id: "master", type: "credit_card", token: "tok", installments: 1 } }] },
    });
  });

  it("envía ítems con cantidad, precio unitario entero como texto, título, categoría y código", () => {
    const { items } = armarOrden(base) as { items: Record<string, unknown>[] };
    expect(items).toEqual([{ external_code: "3", title: "Cera", description: "Cera", category_id: "beauty", quantity: 2, unit_price: "12500" }]);
  });

  it("la descripción del producto va en el ítem; sin ella o en blanco se repite el nombre, y se corta en 255", () => {
    const desc = (descripcion: string | null | undefined) =>
      (armarOrden({ ...base, items: [{ ...base.items[0], descripcion }] }) as { items: { description: string }[] }).items[0].description;
    expect(desc("Cera mate de fijación fuerte")).toBe("Cera mate de fijación fuerte");
    expect(desc(null)).toBe("Cera");
    expect(desc("   ")).toBe("Cera");
    expect(desc("x".repeat(300))).toHaveLength(255);
  });

  it("la suma de los ítems es el total del pedido", () => {
    const o = armarOrden({ ...base, monto: "30000", items: [
      { idProducto: 1, nombre: "A", cantidad: 2, precioUnitario: 10000 }, { idProducto: 2, nombre: "B", cantidad: 1, precioUnitario: 10000 },
    ] }) as { items: { quantity: number; unit_price: string }[]; total_amount: string };
    expect(o.items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0)).toBe(Number(o.total_amount));
  });

  it("envía el comprador, el descriptor y la fecha de registro", () => {
    const o = armarOrden(base) as Detalle;
    expect(o.payer).toEqual({ email: "cliente@correo.cl", first_name: "Ana", last_name: "Pérez" });
    expect(o.transactions.payments[0].payment_method.statement_descriptor).toBe("BARBERIA BENJVMIN");
    expect(o.additional_info).toEqual({ "payer.authentication_type": "WEB", "payer.registration_date": "2026-01-02T03:04:05.000Z" });
  });

  it("envía el RUT como identificación del comprador solo si viene", () => {
    const con = armarOrden({ ...base, comprador: { ...base.comprador, rut: "12345678-5" } }) as Detalle;
    expect(con.payer.identification).toEqual({ type: "RUT", number: "12345678-5" });
    expect((armarOrden(base) as Detalle).payer).not.toHaveProperty("identification");
  });

  it("omite lo que no hay: apellido, correo, fecha y descriptor vacío", () => {
    const o = armarOrden({ ...base, email: undefined, barberia: "***", comprador: { nombre: "Ana", apellido: null, registradoEn: null } }) as Detalle;
    expect(o.payer).toEqual({ first_name: "Ana" });
    expect(o.transactions.payments[0].payment_method).not.toHaveProperty("statement_descriptor");
    expect(o.additional_info).toEqual({ "payer.authentication_type": "WEB" });
  });
});
