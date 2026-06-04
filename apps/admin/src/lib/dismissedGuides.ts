const PREFIX = 'bc-guide-dismissed:';

export function isGuideDismissed(guideKey: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${guideKey}`) === '1';
  } catch {
    return false;
  }
}

export function dismissGuide(guideKey: string): void {
  try {
    localStorage.setItem(`${PREFIX}${guideKey}`, '1');
  } catch {
    /* quota / mode privé */
  }
}
