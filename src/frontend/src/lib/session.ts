const DISCLAIMER_KEY = 'trade_analyzer_disclaimer_acknowledged';

export function hasAcknowledgedDisclaimer(): boolean {
  try {
    return sessionStorage.getItem(DISCLAIMER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDisclaimerAcknowledged(): void {
  try {
    sessionStorage.setItem(DISCLAIMER_KEY, 'true');
  } catch {
    // Silently fail if sessionStorage is not available
  }
}
