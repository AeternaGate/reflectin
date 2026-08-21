export interface Me {
  plan: string;
  limits: { channels: number; quota: number };
}
export interface Channel {
  id: string;
  title: string;
  username: string;
  style: string;
  max_posts_per_day: number;
  post_hour: number;
  vacation_from: string | null;
  vacation_to: string | null;
  features: Record<string, boolean>;
}
export interface Draft {
  id: string;
  rubric: string;
  topic: string;
  text: string;
  created_at: string;
}
export interface Template {
  id: string;
  name: string;
  content: string;
}
export interface PlanItem {
  day: number;
  date: string;
  rubric: string;
  topic: string;
}
export interface Trend {
  source: string;
  title: string;
  url: string;
  published_at: string;
}
