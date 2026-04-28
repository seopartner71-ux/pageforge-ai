export type CompetitionLevel = 'easy' | 'medium' | 'hard' | null;

export interface BlogTopic {
  id: string;
  job_id: string;
  keyword: string;
  ws_frequency: number;
  word_count: number;
  intent: string;
  competition_level: CompetitionLevel;
  strong_count: number | null;
  serp_urls: string[];
  blog_score: number;
  traffic_potential: number;
  data_source: string;
  serp_checked: boolean;
  created_at: string;
}

export interface BlogTopicsJob {
  id: string;
  user_id: string;
  status: string;
  progress: number;
  input_topic: string;
  input_region: string;
  topic_count: number;
  serp_checked: number;
  serp_total: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export const COMPETITION_META: Record<NonNullable<CompetitionLevel>, { label: string; emoji: string; badge: string }> = {
  easy:   { label: 'Низкая',  emoji: '🟢', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' },
  medium: { label: 'Средняя', emoji: '🟡', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/40' },
  hard:   { label: 'Высокая', emoji: '🔴', badge: 'bg-red-500/15 text-red-300 border border-red-500/40' },
};