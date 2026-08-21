import type { Db } from "../_shared/db.ts";

export function invoiceUrl(token: string, chatId: number, amount: number, title: string): string {
  return `https://api.telegram.org/bot${token}/createInvoiceLink?chat_id=${chatId}&title=${encodeURIComponent(title)}&description=${encodeURIComponent("Подписка Reflectin")}&payload=${encodeURIComponent(`plan:${title.toLowerCase()}`)}&provider_token=&currency=XTR&prices=${encodeURIComponent(`[{"label":"${title}","amount":${amount}}]`)}`;
}

export async function applyPlanPayment(db: Db, userId: string, plan: string): Promise<void> {
  await db.from("users").eq("id", userId).update({ plan });
}
