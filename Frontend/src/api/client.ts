import type {
  ActivityResponse,
  AuthResponse,
  GapsResponse,
  NoteItem,
  PieResponse,
  UploadNoteResponse,
  TestAnswerResponse,
  TestStartResponse,
  Topic,
  ChatResponse
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

type RequestMethod = 'GET' | 'POST';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  method: RequestMethod = 'GET',
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const parsed = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const message =
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.msg === 'string' && parsed.msg) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      (typeof data === 'string' && data) ||
      'Request failed';

    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const api = {
  register: (payload: { username: string; email: string; password: string; role: 'Student' | 'Admin' | 'Mentor' }) =>
    request<{ message: string }>('/api/auth/register', 'POST', payload),

  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', 'POST', payload),

  getTopics: () => request<Topic[]>('/api/quiz/topics'),

  getActivity: (token: string, month: number, year: number) =>
    request<ActivityResponse>(`/api/dashboard/activity?month=${month}&year=${year}`, 'GET', undefined, token),

  sendHeartbeat: (token: string) =>
    request<{ message: string }>('/api/dashboard/heartbeat', 'POST', {}, token),

  getQuizPie: (token: string) => request<PieResponse>('/api/dashboard/quiz-pie', 'GET', undefined, token),

  getNotes: (token: string) => request<NoteItem[]>('/api/library/notes', 'GET', undefined, token),

  uploadNote: (token: string, payload: { title: string; content: string }) =>
    request<UploadNoteResponse>('/api/library/notes', 'POST', payload, token),

  uploadNoteFile: async (token: string, payload: { title: string; file: File }) => {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('file', payload.file);

    const response = await fetch(`${API_BASE}/api/library/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const raw = await response.text();
    let data: unknown = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    if (!response.ok) {
      const parsed = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
      const message =
        (typeof parsed.message === 'string' && parsed.message) ||
        (typeof parsed.msg === 'string' && parsed.msg) ||
        (typeof parsed.error === 'string' && parsed.error) ||
        (typeof data === 'string' && data) ||
        'Request failed';

      throw new ApiError(message, response.status);
    }

    return data as UploadNoteResponse;
  },

  generateMcq: (token: string, noteId: number, count = 10) =>
    request<{ message: string; questions_count: number }>(`/api/library/notes/${noteId}/generate-mcq`, 'POST', { count }, token),

  askChat: (token: string, payload: { message: string; note_id?: number }) =>
    request<ChatResponse>('/api/chatbot/message', 'POST', payload, token),

  startTest: (token: string, payload: { note_id?: number; topic_id?: number; count?: number }) =>
    request<TestStartResponse>('/api/chatbot/test/start', 'POST', payload, token),

  answerTest: (token: string, payload: { quiz_session_id: number; question_id: number; selected_option: 'A' | 'B' | 'C' | 'D' }) =>
    request<TestAnswerResponse>('/api/chatbot/test/answer', 'POST', payload, token),

  analyzeGaps: (token: string) => request<{ message: string; recommendations: unknown[] }>('/api/recommend/analyze', 'POST', {}, token),

  getGaps: (token: string) => request<GapsResponse>('/api/recommend/gaps', 'GET', undefined, token)
};