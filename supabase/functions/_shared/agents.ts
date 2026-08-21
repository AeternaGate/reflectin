import { extractJson } from "./json.ts";

export interface PipelineStep {
  name: string;
  build: (ctx: string) => string;
}

export type GenerateFn = (prompt: string) => Promise<{ text: string; model: string }>;

export async function runPipeline(
  steps: PipelineStep[],
  generate: GenerateFn,
  input: string,
): Promise<{ text: string; calls: number }> {
  let ctx = input;
  let calls = 0;
  for (const step of steps) {
    const { text } = await generate(step.build(ctx));
    calls += 1;
    ctx = text;
  }
  return { text: ctx, calls };
}

/** Агент-ресёрчер: просит структурированные факты по теме. */
export function researchStep(topic: string): PipelineStep {
  return {
    name: "research",
    build: (ctx) => {
      const idea = ctx.trim().startsWith("{") ? (extractJson(ctx) as { topic?: string }).topic ?? topic : topic;
      return `Собери 3-5 фактов/идей по теме «${idea}». Верни ТОЛЬКО JSON: {"topic":"...","facts":["..."]}.`;
    },
  };
}

/** Агент-писатель: пишет пост из результатов ресёрча. */
export function writerStep(): PipelineStep {
  return {
    name: "write",
    build: (ctx) => `Напиши телеграм-пост на основе: ${ctx}. Без эмодзи, короткие абзацы, живой голос.`,
  };
}

/** Агент-редактор: чистит и усиливает вовлечение. */
export function editorStep(): PipelineStep {
  return {
    name: "editor",
    build: (ctx) =>
      `Отредактируй пост для максимального вовлечения: ${ctx}. Верни ТОЛЬКО финальный текст поста.`,
  };
}
