export type UserRole = 'Admin' | 'Mentor' | 'Student';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: UserRole;
}

export interface AuthResponse {
  message: string;
  access_token: string;
  user: AuthUser;
}

export interface Topic {
  id: number;
  name: string;
  description: string;
}

export interface NoteItem {
  id: number;
  title: string;
  created_at: string;
  content_preview: string;
}

export interface UploadNoteResponse {
  message: string;
  note: {
    id: number;
    title: string;
    created_at: string;
  };
}

export interface ActivityDay {
  day: number;
  count: number;
  worked_minutes?: number;
  shade?: 'none' | 'green' | 'light_green' | 'dark_green';
}

export interface ActivityResponse {
  month: number;
  year: number;
  days_active: number;
  activity_by_day: ActivityDay[];
  total_activities: number;
}

export interface PieResponse {
  labels: string[];
  values: number[];
  percentages: number[];
  total_tests?: number;
  message?: string;
}

export interface GapItem {
  topic_id: number;
  topic_name: string;
  gap_score: number;
  suggested_revision: string;
  created_at: string;
}

export interface GapsResponse {
  gaps?: GapItem[];
  message?: string;
}

export interface ChatResponse {
  reply: string;
}

export interface QuestionPayload {
  id: number;
  question_text: string;
  options: Record<'A' | 'B' | 'C' | 'D', string>;
}

export interface TestStartResponse {
  message: string;
  quiz_session_id: number;
  note_id?: number;
  topic_id?: number;
  total_questions: number;
  current_question: QuestionPayload | null;
}

export interface TestAnswerResponse {
  message: string;
  result?: string;
  feedback?: string;
  hint?: string;
  question?: QuestionPayload;
  next_question?: QuestionPayload;
  quiz_completed: boolean;
  score?: number;
  correct?: number;
  total?: number;
  second_chance_remaining?: boolean;
  correct_option?: string;
}
