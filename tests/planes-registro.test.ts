import { describe, expect, it } from "vitest";
import { planesRegistrables, type Plan } from "../lib/planes";

const plan = (id_plan: number, precio_mensual: number, es_plan_prueba = false) =>
  ({ id_plan, precio_mensual, es_plan_prueba }) as Plan;
const planes = [plan(1, 0), plan(2, 500, true), plan(3, 19990)];

describe("planesRegistrables", () => {
  it("sin prueba disponible no ofrece planes que Mercado Pago no puede cobrar (quedarían sin forma de activarse)", () => {
    expect(planesRegistrables(planes, false).map((p) => p.id_plan)).toEqual([3]);
  });
  it("con prueba disponible el plan de prueba sí se ofrece", () => {
    expect(planesRegistrables(planes, true).map((p) => p.id_plan)).toEqual([2, 3]);
  });
});
