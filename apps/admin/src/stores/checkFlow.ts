import { create } from 'zustand';
import type { TabletFlowAccess } from '@/lib/checkFlowTabletAccess';
import { api } from '@/lib/api';

export type CheckFlowKind = 'CHECK_IN' | 'CHECK_OUT';
export type CheckQuestionType = 'TEXT' | 'BOOLEAN' | 'SELECT' | 'PHOTO' | 'FUEL_GAUGE';

export const CHECK_FLOW_KIND_LABELS: Record<CheckFlowKind, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
};

export const CHECK_QUESTION_TYPE_LABELS: Record<CheckQuestionType, string> = {
  TEXT: 'Texte libre',
  BOOLEAN: 'Oui / Non',
  SELECT: 'Liste de choix',
  PHOTO: 'Photo(s)',
  FUEL_GAUGE: 'Jauge essence (0–100 %)',
};

export type CheckFlowQuestion = {
  id: string;
  kind: CheckFlowKind;
  sortOrder: number;
  label: string;
  helpText: string | null;
  questionType: CheckQuestionType;
  required: boolean;
  optionsJson: string | null;
  photoMinCount: number;
  photoMaxCount: number;
  enabled: boolean;
};

export type CheckFlowSubmissionSummary = {
  id: string;
  reservationId: string;
  kind: CheckFlowKind;
  submittedAt: string;
  summaryJson: string | null;
  clientSignatureUrl?: string | null;
  agentSignatureUrl?: string | null;
  submittedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  reservation?: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    boat: { id: string; name: string; brand: string };
  };
  answers?: Array<{
    id: string;
    valueText: string | null;
    valueJson: string | null;
    commentText: string | null;
    question: CheckFlowQuestion;
  }>;
};

export type CheckFlowQuestionInput = {
  id?: string;
  label: string;
  helpText?: string | null;
  questionType: CheckQuestionType;
  required?: boolean;
  options?: string[];
  photoMinCount?: number;
  photoMaxCount?: number;
  enabled?: boolean;
};

function parseOptions(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function questionOptions(q: CheckFlowQuestion): string[] {
  return parseOptions(q.optionsJson);
}

export function formatCheckAnswerDisplay(
  questionType: CheckQuestionType,
  valueText: string | null,
): string {
  if (valueText == null || valueText === '') return '—';
  if (questionType === 'BOOLEAN') return valueText === 'true' ? 'Oui' : 'Non';
  if (questionType === 'FUEL_GAUGE') return `${valueText} %`;
  return valueText;
}

export function submissionSummaryLines(summaryJson: string | null): string[] {
  if (!summaryJson) return [];
  try {
    const o = JSON.parse(summaryJson) as { lines?: string[] };
    return Array.isArray(o.lines) ? o.lines : [];
  } catch {
    return [];
  }
}

export type CheckFlowSettings = {
  checkOutUsesCheckInForm: boolean;
};

interface CheckFlowState {
  questionsCheckIn: CheckFlowQuestion[];
  questionsCheckOut: CheckFlowQuestion[];
  settings: CheckFlowSettings;
  loading: boolean;
  fetchSettings: () => Promise<CheckFlowSettings>;
  updateSettings: (patch: Partial<CheckFlowSettings>) => Promise<CheckFlowSettings>;
  fetchQuestions: (kind: CheckFlowKind, opts?: { all?: boolean }) => Promise<void>;
  syncQuestions: (kind: CheckFlowKind, questions: CheckFlowQuestionInput[]) => Promise<void>;
  fetchReservationStatus: (reservationId: string) => Promise<{
    checkIn: CheckFlowSubmissionSummary | null;
    checkOut: CheckFlowSubmissionSummary | null;
    checkInAccess: TabletFlowAccess;
    checkOutAccess: TabletFlowAccess;
  }>;
  listSubmissions: (params?: {
    kind?: CheckFlowKind;
    reservationId?: string;
    from?: string;
    to?: string;
  }) => Promise<CheckFlowSubmissionSummary[]>;
  getSubmission: (id: string) => Promise<CheckFlowSubmissionSummary>;
  submit: (payload: {
    reservationId: string;
    kind: CheckFlowKind;
    answers: Array<{
      questionId: string;
      valueText?: string | null;
      comment?: string | null;
      photos?: string[];
    }>;
    clientSignature: string;
    agentSignature: string;
  }) => Promise<CheckFlowSubmissionSummary>;
  updateSubmission: (
    submissionId: string,
    payload: {
      answers: Array<{
        questionId: string;
        valueText?: string | null;
        comment?: string | null;
        photos?: string[];
      }>;
      clientSignature: string;
      agentSignature: string;
    },
  ) => Promise<CheckFlowSubmissionSummary>;
  fetchTabletReservations: (day?: string) => Promise<TabletReservationRow[]>;
}

export type TabletReservationRow = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  boat: { id: string; name: string; brand: string };
  checkFlowSubmissions: Array<{
    id: string;
    kind: CheckFlowKind;
    submittedAt: string;
    summaryJson: string | null;
  }>;
};

export const useCheckFlowStore = create<CheckFlowState>((set, get) => ({
  questionsCheckIn: [],
  questionsCheckOut: [],
  settings: { checkOutUsesCheckInForm: false },
  loading: false,

  async fetchSettings() {
    const { data } = await api.get<CheckFlowSettings>('/check-flow/settings');
    const settings = {
      checkOutUsesCheckInForm: Boolean(data?.checkOutUsesCheckInForm),
    };
    set({ settings });
    return settings;
  },

  async updateSettings(patch) {
    const next = { ...get().settings, ...patch };
    const { data } = await api.put<CheckFlowSettings>('/check-flow/settings', next);
    const settings = {
      checkOutUsesCheckInForm: Boolean(data?.checkOutUsesCheckInForm),
    };
    set({ settings });
    return settings;
  },

  async fetchQuestions(kind, opts) {
    set({ loading: true });
    try {
      const { data } = await api.get<CheckFlowQuestion[]>('/check-flow/questions', {
        params: { kind, ...(opts?.all ? { all: '1' } : {}) },
      });
      if (kind === 'CHECK_IN') set({ questionsCheckIn: data });
      else set({ questionsCheckOut: data });
    } finally {
      set({ loading: false });
    }
  },

  async syncQuestions(kind, questions) {
    const { data } = await api.put<CheckFlowQuestion[]>('/check-flow/questions', { kind, questions });
    if (kind === 'CHECK_IN') set({ questionsCheckIn: data });
    else set({ questionsCheckOut: data });
  },

  async fetchReservationStatus(reservationId) {
    const { data } = await api.get<{
      checkIn: CheckFlowSubmissionSummary | null;
      checkOut: CheckFlowSubmissionSummary | null;
      checkInAccess: TabletFlowAccess;
      checkOutAccess: TabletFlowAccess;
    }>(`/check-flow/reservations/${reservationId}/status`);
    return data;
  },

  async listSubmissions(params) {
    const { data } = await api.get<CheckFlowSubmissionSummary[]>('/check-flow/submissions', { params });
    return data;
  },

  async getSubmission(id) {
    const { data } = await api.get<CheckFlowSubmissionSummary>(`/check-flow/submissions/${id}`);
    return data;
  },

  async submit(payload) {
    const { data } = await api.post<CheckFlowSubmissionSummary>('/check-flow/submissions', payload);
    return data;
  },

  async updateSubmission(submissionId, payload) {
    const { data } = await api.patch<CheckFlowSubmissionSummary>(
      `/check-flow/submissions/${submissionId}`,
      payload,
    );
    return data;
  },

  async fetchTabletReservations(day) {
    const { data } = await api.get<TabletReservationRow[]>('/check-flow/tablet/reservations', {
      params: day ? { day } : undefined,
    });
    return data;
  },
}));
