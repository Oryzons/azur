import type { CheckFlowSubmissionSummary } from '@/stores/checkFlow';

export type CheckFlowFormAnswers = Record<
  string,
  { text?: string; photos?: string[]; comment?: string }
>;

function parsePhotoUrls(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function answersFromSubmission(detail: CheckFlowSubmissionSummary): CheckFlowFormAnswers {
  const map: CheckFlowFormAnswers = {};
  for (const a of detail.answers ?? []) {
    map[a.question.id] = {
      text: a.valueText ?? undefined,
      photos: a.valueJson ? parsePhotoUrls(a.valueJson) : undefined,
      comment: a.commentText ?? undefined,
    };
  }
  return map;
}
