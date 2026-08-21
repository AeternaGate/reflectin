import type { Db } from "../_shared/db.ts";
import { getOrCreateUser, quotaUsedToday, insertPost, logGeneration } from "../_shared/db.ts";
import { buildPostPrompt, type Rubric } from "../_shared/prompts.ts";
import { dailyQuota } from "../_shared/plans.ts";
import { runPipeline, researchStep, writerStep, editorStep } from "../_shared/agents.ts";
import { classifyComment } from "../_shared/moderation.ts";
import { matchFaq, shouldEscalate } from "../_shared/autoreply.ts";
import { isEnabled } from "../_shared/features.ts";
import { PLAN_PRICES } from "../_shared/payments.ts";
import { applyPlanPayment } from "./stars.ts";

export interface BotDeps {
  db: Db;
  freeQuota: number;
  webappUrl: string;
  generate: (prompt: string) => Promise<{ text: string; model: string }>;
  sendMessage: (chatId: number, text: string, opts?: Record<string, unknown>) => Promise<unknown>;
  deleteMessage?: (chatId: number, messageId: number) => Promise<unknown>;
  restrictChatMember?: (chatId: number, userId: number) => Promise<unknown>;
  answerPreCheckout?: (queryId: string, ok: boolean) => Promise<unknown>;
  sendInvoiceUrl?: (chatId: number, title: string, payload: string) => Promise<unknown>;
}

interface TgFrom { id: number; is_bot?: boolean; first_name?: string }
interface TgMessage {
  message_id: number;
  chat: { id: number; type?: string };
  from?: TgFrom;
  text?: string;
  successful_payment?: { invoice_payload?: string };
}
interface TgUpdate {
  message?: TgMessage;
  pre_checkout_query?: { id: string };
}

type UpdateKind =
  | "start" | "post" | "quota" | "agent" | "moderate"
  | "autoreply" | "tariffs" | "checkout" | "payment" | null;

const RUBRIC_ORDER: Rubric[] = ["польза", "вовлечение", "продажи", "личное"];

export async function handleUpdate(
  update: unknown,
  deps: BotDeps,
): Promise<UpdateKind> {
  const upd = update as TgUpdate;

  if (upd.pre_checkout_query) {
    await deps.answerPreCheckout?.(upd.pre_checkout_query.id, true);
    return "checkout";
  }

  const msg = upd.message;
  if (!msg?.chat) return null;
  const chatId = msg.chat.id;

  if (msg.successful_payment) {
    const plan = (msg.successful_payment.invoice_payload ?? "").replace(/^plan:/, "");
    if (!msg.from || !(plan in PLAN_PRICES)) return null;
    const dbUser = await getOrCreateUser(deps.db, msg.from.id, msg.from.first_name ?? "");
    await applyPlanPayment(deps.db, dbUser.id, plan);
    await deps.sendMessage(chatId, `Оплата получена — тариф ${plan.toUpperCase()} активирован.`);
    return "payment";
  }

  const text = msg.text;
  if (!text) return null;

  if (text === "/start") {
    await deps.sendMessage(
      chatId,
      "Привет! Я Reflectin — генерирую посты для твоего канала. Пиши тему — и я оформлю пост.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть Reflectin", web_app: { url: deps.webappUrl } }]],
        },
      },
    );
    return "start";
  }

  if (text.startsWith("/fact ") || text === "/fact") {
    const topic = text === "/fact" ? "" : text.slice(6).trim();
    if (!topic) {
      await deps.sendMessage(chatId, "Укажи тему: /fact бухгалтерия для ИП");
      return "agent";
    }
    if (!msg.from) return null;
    const dbUser = await getOrCreateUser(deps.db, msg.from.id, msg.from.first_name ?? "");
    if (dbUser.plan !== "pro") {
      await deps.sendMessage(chatId, "Агенты доступны на тарифе Pro");
      return "agent";
    }
    const date = new Date().toISOString().slice(0, 10);
    const used = await quotaUsedToday(deps.db, dbUser.id, date);
    if (used >= dailyQuota(dbUser.plan, deps.freeQuota)) {
      await deps.sendMessage(chatId, "Дневной лимит генераций исчерпан.");
      return "agent";
    }
    const { text: result } = await runPipeline(
      [researchStep(topic), writerStep(), editorStep()],
      deps.generate,
      topic,
    );
    await insertPost(deps.db, { user_id: dbUser.id, content: result, rubric: "новость", status: "draft" });
    await logGeneration(deps.db, { user_id: dbUser.id, feature: "agent", model: "pipeline" });
    await deps.sendMessage(chatId, result);
    return "agent";
  }

  if (text === "/tariffs") {
    if (!deps.sendInvoiceUrl) {
      await deps.sendMessage(chatId, "Оплата звёздами скоро будет доступна.");
      return "tariffs";
    }
    for (const plan of Object.keys(PLAN_PRICES)) {
      await deps.sendInvoiceUrl(chatId, plan.charAt(0).toUpperCase() + plan.slice(1), `plan:${plan}`);
    }
    return "tariffs";
  }

  if (text.startsWith("/")) return null;

  if (chatId < 0) {
    if (!msg.from || msg.from.is_bot) return null;
    const { data: ch } = await deps.db.from("channels")
      .select("id, user_id, features").eq("telegram_channel_id", chatId).maybeSingle();
    const chan = ch as { id: string; user_id: string; features?: Record<string, boolean> } | null;
    if (!chan) return null;

    const cls = classifyComment(text);
    if (isEnabled(chan.features, "moderation", true)) {
      if (cls.spam) {
        await deps.deleteMessage?.(chatId, msg.message_id);
        await deps.restrictChatMember?.(chatId, msg.from.id);
        return "moderate";
      }
      if (shouldEscalate(text, cls.stance)) {
        const { data: owner } = await deps.db.from("users")
          .select("telegram_id").eq("id", chan.user_id).maybeSingle();
        const tid = (owner as { telegram_id?: number } | null)?.telegram_id;
        if (tid) {
          await deps.sendMessage(
            Number(tid),
            `Требует ответа: негативный вопрос в обсуждении — «${text}»`,
          );
        }
        return "moderate";
      }
    }

    if (isEnabled(chan.features, "autoreply", true)) {
      const { data: kb } = await deps.db.from("knowledge_base")
        .select("content").eq("channel_id", chan.id);
      const faq = ((kb ?? []) as Array<{ content: string }>).flatMap((r) =>
        String(r.content).split(/\s+/)
          .filter((w) => w.length >= 4)
          .map((w) => ({ q: w, a: String(r.content) }))
      );
      const answer = matchFaq(text, faq);
      if (answer) {
        await deps.sendMessage(chatId, answer);
        return "autoreply";
      }
    }
    return null;
  }

  if (!msg.from) return null;
  const date = new Date().toISOString().slice(0, 10);
  const dbUser = await getOrCreateUser(deps.db, msg.from.id, msg.from.first_name ?? "");
  const used = await quotaUsedToday(deps.db, dbUser.id, date);
  if (used >= deps.freeQuota) {
    await deps.sendMessage(chatId, "Ваш лимит на сегодня исчерпан (5/5). Попробуй завтра или открой Mini App.");
    return "quota";
  }

  const rubric = RUBRIC_ORDER[text.length % RUBRIC_ORDER.length];
  const prompt = buildPostPrompt({ topic: text, rubric });
  const { text: post, model } = await deps.generate(prompt);
  await insertPost(deps.db, { user_id: dbUser.id, content: post, rubric, status: "draft" });
  await logGeneration(deps.db, { user_id: dbUser.id, feature: "post", model });
  await deps.sendMessage(chatId, post);
  return "post";
}
