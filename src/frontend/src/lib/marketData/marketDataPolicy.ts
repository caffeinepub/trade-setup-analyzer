/**
 * Centralized policy constants for market data fetching
 * Controls caching, request spacing, and retry behavior
 */

// Cache TTL: How long to reuse successful results for the same ticker
export const CACHE_TTL_MS = 60_000; // 60 seconds

// Request spacing: Minimum time between actual network calls per ticker
export const MIN_REQUEST_INTERVAL_MS = 5_000; // 5 seconds

// Exponential backoff policy for rate-limit retries
export const MAX_RETRIES = 3;
export const BASE_DELAY_MS = 10_000; // 10 seconds
export const MAX_DELAY_MS = 60_000; // 60 seconds

/**
 * Normalize ticker symbol for consistent cache/spacing keys
 */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attemptNumber - 1);
  return Math.min(delay, MAX_DELAY_MS);
}
