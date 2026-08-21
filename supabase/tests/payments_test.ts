import { assertEquals } from "jsr:@std/assert";
import { planByStars, starsByPlan, PLAN_PRICES } from "../functions/_shared/payments.ts";

Deno.test("PLAN_PRICES: тарифы по ТЗ в звёздах", () => {
  assertEquals(PLAN_PRICES.starter, 199);
  assertEquals(PLAN_PRICES.pro, 499);
  assertEquals(PLAN_PRICES.agency, 999);
});

Deno.test("starsByPlan: возвращает цену плана", () => {
  assertEquals(starsByPlan("pro"), 499);
});

Deno.test("starsByPlan: неизвестный план — null", () => {
  assertEquals(starsByPlan("god"), null);
});

Deno.test("planByStars: точное совпадение суммы", () => {
  assertEquals(planByStars(199), "starter");
  assertEquals(planByStars(499), "pro");
  assertEquals(planByStars(999), "agency");
});

Deno.test("planByStars: неизвестная сумма — null", () => {
  assertEquals(planByStars(150), null);
  assertEquals(planByStars(0), null);
});