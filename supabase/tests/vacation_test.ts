import { assertEquals, assert } from "jsr:@std/assert";
import { isVacationOn, vacationPolicy } from "../functions/_shared/vacation.ts";

const VACATION = { from: "2026-08-10", to: "2026-08-17" };

Deno.test("isVacationOn: дата внутри окна — да", () => {
  assert(isVacationOn(VACATION, "2026-08-12"));
});

Deno.test("isVacationOn: границы включены", () => {
  assert(isVacationOn(VACATION, "2026-08-10"));
  assert(isVacationOn(VACATION, "2026-08-17"));
});

Deno.test("isVacationOn: вне окна — нет", () => {
  assertEquals(isVacationOn(VACATION, "2026-08-09"), false);
  assertEquals(isVacationOn(VACATION, "2026-08-18"), false);
});

Deno.test("isVacationOn: без отпуска — никогда", () => {
  assertEquals(isVacationOn(null, "2026-08-12"), false);
});

Deno.test("vacationPolicy: во время отпуска — пауза публикаций", () => {
  const p = vacationPolicy(VACATION, "2026-08-12");
  assertEquals(p, "pause");
});

Deno.test("vacationPolicy: вне отпуска — без изменений", () => {
  assertEquals(vacationPolicy(VACATION, "2026-08-20"), null);
});