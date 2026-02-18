/**
 * Client-side market data wrapper with caching, de-duplication, and retry logic
 */

import { fetchMarketData } from './fetchMarketData';
import { normalizeTicker, CACHE_TTL_MS, MIN_REQUEST_INTERVAL_MS, MAX_RETRIES, calculateBackoffDelay } from './marketDataPolicy';
import type { MarketDataResult, MarketDataError } from './types';

interface CacheEntry {
  result: MarketDataResult;
  timestamp: number;
}

interface RequestState {
  lastRequestTime: number;
  inFlightPromise: Promise<MarketDataResult | MarketDataError> | null;
}

interface RetryState {
  attemptCount: number;
  nextRetryTime: number | null;
  timeoutId: NodeJS.Timeout | null;
}

class MarketDataClient {
  private cache = new Map<string, CacheEntry>();
  private requestStates = new Map<string, RequestState>();
  private retryStates = new Map<string, RetryState>();

  /**
   * Fetch market data with caching, de-duplication, spacing, and automatic retry
   */
  async fetch(ticker: string): Promise<MarketDataResult | MarketDataError> {
    const normalizedTicker = normalizeTicker(ticker);
    const now = Date.now();

    // Check cache first
    const cached = this.cache.get(normalizedTicker);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }

    // Check if already in-flight
    const requestState = this.requestStates.get(normalizedTicker);
    if (requestState?.inFlightPromise) {
      return requestState.inFlightPromise;
    }

    // Check minimum request interval
    if (requestState && now - requestState.lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
      // Return cached if available, otherwise wait
      if (cached) {
        return cached.result;
      }
      // Wait for minimum interval
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - (now - requestState.lastRequestTime)));
    }

    // Create new request
    const promise = this.executeRequest(normalizedTicker);
    
    // Store in-flight promise
    this.requestStates.set(normalizedTicker, {
      lastRequestTime: now,
      inFlightPromise: promise,
    });

    try {
      const result = await promise;
      
      // Clear in-flight
      const state = this.requestStates.get(normalizedTicker);
      if (state) {
        state.inFlightPromise = null;
      }

      // Type guard for error result
      const isErrorResult = (r: MarketDataResult | MarketDataError): r is MarketDataError => {
        return 'error' in r;
      };

      // Handle rate limit with retry
      if (isErrorResult(result) && result.isRateLimited) {
        return this.handleRateLimit(normalizedTicker, result);
      }

      // Cache successful results
      if (!isErrorResult(result)) {
        this.cache.set(normalizedTicker, {
          result,
          timestamp: Date.now(),
        });
        // Clear any retry state on success
        this.clearRetryState(normalizedTicker);
      }

      return result;
    } catch (error) {
      // Clear in-flight on error
      const state = this.requestStates.get(normalizedTicker);
      if (state) {
        state.inFlightPromise = null;
      }
      throw error;
    }
  }

  private async executeRequest(ticker: string): Promise<MarketDataResult | MarketDataError> {
    return fetchMarketData(ticker);
  }

  private async handleRateLimit(ticker: string, error: MarketDataError): Promise<MarketDataError> {
    const retryState = this.retryStates.get(ticker) || {
      attemptCount: 0,
      nextRetryTime: null,
      timeoutId: null,
    };

    retryState.attemptCount += 1;

    if (retryState.attemptCount > MAX_RETRIES) {
      // Exhausted retries
      this.clearRetryState(ticker);
      return {
        ...error,
        error: 'Rate limit reached. Please wait a few minutes before trying again.',
      };
    }

    const delay = calculateBackoffDelay(retryState.attemptCount);
    retryState.nextRetryTime = Date.now() + delay;
    this.retryStates.set(ticker, retryState);

    // Return error with retry info (the hook will handle the UI)
    return error;
  }

  /**
   * Schedule and execute automatic retry
   */
  async scheduleRetry(ticker: string, onRetry: (result: MarketDataResult | MarketDataError) => void): Promise<void> {
    const normalizedTicker = normalizeTicker(ticker);
    const retryState = this.retryStates.get(normalizedTicker);

    if (!retryState || !retryState.nextRetryTime) {
      return;
    }

    const delay = Math.max(0, retryState.nextRetryTime - Date.now());

    // Clear any existing timeout
    if (retryState.timeoutId) {
      clearTimeout(retryState.timeoutId);
    }

    retryState.timeoutId = setTimeout(async () => {
      const result = await this.fetch(normalizedTicker);
      onRetry(result);
    }, delay);

    this.retryStates.set(normalizedTicker, retryState);
  }

  /**
   * Get retry state for a ticker (for UI display)
   */
  getRetryState(ticker: string): { attemptCount: number; nextRetryTime: number | null } | null {
    const normalizedTicker = normalizeTicker(ticker);
    const state = this.retryStates.get(normalizedTicker);
    if (!state) return null;
    return {
      attemptCount: state.attemptCount,
      nextRetryTime: state.nextRetryTime,
    };
  }

  /**
   * Clear retry state for a ticker
   */
  private clearRetryState(ticker: string): void {
    const state = this.retryStates.get(ticker);
    if (state?.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    this.retryStates.delete(ticker);
  }

  /**
   * Clear all cache and state (e.g., on logout)
   */
  clearAll(): void {
    this.cache.clear();
    this.requestStates.clear();
    for (const [ticker] of this.retryStates) {
      this.clearRetryState(ticker);
    }
  }
}

// Singleton instance
export const marketDataClient = new MarketDataClient();
