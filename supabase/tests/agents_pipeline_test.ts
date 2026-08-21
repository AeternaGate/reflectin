import { assertEquals, assert } from "jsr:@std/assert";
import { runPipeline, type PipelineStep, type GenerateFn } from "../functions/_shared/agents.ts";

const steps: PipelineStep[] = [
  { name: "research", build: (ctx) => `Исследуй: ${ctx}` },
  { name: "write", build: (ctx) => `Напиши пост, опираясь на: ${ctx}` },
];

Deno.test("runPipeline: прогоняет все шаги и возвращает финальный текст", async () => {
  const calls: string[] = [];
  const generate: GenerateFn = async (prompt: string) => {
    calls.push(prompt);
    return { text: `result#${calls.length}`, model: "m" };
  };
  const out = await runPipeline(steps, generate, "тема");
  assertEquals(calls.length, 2);
  assert(calls[0].includes("тема"));
  assert(calls[1].includes("result#1"));
  assertEquals(out.text, "result#2");
});

Deno.test("runPipeline: пустой список шагов возвращает вход напрямую", async () => {
  const generate: GenerateFn = async () => {
    throw new Error("не должен вызываться");
  };
  const out = await runPipeline([], generate, "тема");
  assertEquals(out.text, "тема");
  assertEquals(out.calls, 0);
});

Deno.test("runPipeline: учитывает количество LLM-вызовов", async () => {
  const generate: GenerateFn = async (p: string) => ({ text: `r(${p})`, model: "m" });
  const out = await runPipeline(steps, generate, "тема");
  assertEquals(out.calls, 2);
});