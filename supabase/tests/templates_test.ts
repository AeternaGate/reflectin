import { assertEquals } from "jsr:@std/assert";
import { applyTemplate } from "../functions/_shared/templates.ts";

Deno.test("applyTemplate: подставляет переменные в плейсхолдеры", () => {
  const t = applyTemplate("Привет, {name}! Твой тариф: {plan}", { name: "Дима", plan: "Pro" });
  assertEquals(t, "Привет, Дима! Твой тариф: Pro");
});

Deno.test("applyTemplate: неизвестный ключ остаётся как есть", () => {
  assertEquals(applyTemplate("{hello} мир", {}), "{hello} мир");
});

Deno.test("applyTemplate: без плейсхолдеров без изменений", () => {
  assertEquals(applyTemplate("просто текст", {}), "просто текст");
});