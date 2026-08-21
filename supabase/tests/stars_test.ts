import { assertEquals, assert } from "jsr:@std/assert";
import { invoiceUrl, applyPlanPayment } from "../functions/telegram-bot/stars.ts";
import { makeFakeDb } from "./fake_db.ts";

Deno.test("invoiceUrl: createInvoiceLink с планом в payload", () => {
  const url = invoiceUrl("t", 1, 199, "Starter");
  assert(url.includes("createInvoiceLink"));
  assert(url.includes("payload="));
  assert(url.includes("currency=XTR"));
  assert(decodeURIComponent(url).includes("plan:starter"));
});

Deno.test("applyPlanPayment: ставит план пользователю", async () => {
  const db = makeFakeDb({ users: [{ id: "u1", plan: "free" }] });
  await applyPlanPayment(db, "u1", "pro");
  assertEquals(db.rows.users[0].plan, "pro");
});
