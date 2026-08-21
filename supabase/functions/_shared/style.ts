export interface StylePref {
  voice: string;
  maxPostsPerDay: number;
}

export function buildStyleBlock(style: StylePref): string {
  const voice = style.voice?.trim() || "без выраженного голоса, нейтрально";
  return `Голос канала: ${voice}. Максимум ${style.maxPostsPerDay} поста в день. Без эмодзи.`;
}
