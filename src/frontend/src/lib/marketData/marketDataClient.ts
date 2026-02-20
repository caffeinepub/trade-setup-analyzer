/**
 * Client-side market data wrapper with caching, de-duplication, and retry logic
 */

import { fetchMarketData } from './fetchMarketData';
import { normalizeTicker, CACHE_TTL_MS, MIN_REQUEST_INTERVAL_MS, MAX_RETRIES, calculateBackoffDelay } from './marketDataPolicy';
import type { MarketDataResult, MarketDataError } from './types';

const DEBUG = false; // Set to true for verbose logging

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[MarketData:client]', ...args);
  }
}

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

export interface DiagnosticData {
  lastRequest?: {
    ticker: string;
    url: string;
    timestamp: number;
  };
  lastResponse?: {
    status: string;
    bodyPreview: string;
    timestamp: number;
  };
  cacheStats: {
    entries: number;
    hits: number;
    misses: number;
    cacheEntries: Array<{ ticker: string; age: number; ttlRemaining: number }>;
  };
  retryHistory: Array<{
    ticker: string;
    attemptCount: number;
    nextRetryTime: number | null;
    backoffDelay: number | null;
  }>;
}

class MarketDataClient {
  private cache = new Map<string, CacheEntry>();
  private requestStates = new Map<string, RequestState>();
  private retryStates = new Map<string, RetryState>();
  
  // Diagnostic tracking
  private cacheHits = 0;
  private cacheMisses = 0;
  private lastRequestDetails: DiagnosticData['lastRequest'] | undefined;
  private lastResponseDetails: DiagnosticData['lastResponse'] | undefined;

  /**
   * Fetch market data with caching, de-duplication, spacing, and automatic retry
   */
  async fetch(ticker: string): Promise<MarketDataResult | MarketDataError> {
    const normalizedTicker = normalizeTicker(ticker);
    const now = Date.now();

    log('Fetch requested for:', normalizedTicker);

    // Check cache first
    const cached = this.cache.get(normalizedTicker);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const ttlRemaining = CACHE_TTL_MS - (now - cached.timestamp);
      log('Cache HIT for', normalizedTicker, '- TTL remaining:', Math.round(ttlRemaining / 1000), 's');
      this.cacheHits++;
      return cached.result;
    } else if (cached) {
      log('Cache EXPIRED for', normalizedTicker, '- age:', Math.round((now - cached.timestamp) / 1000), 's');
    } else {
      log('Cache MISS for', normalizedTicker);
    }
    this.cacheMisses++;

    // Check if already in-flight
    const requestState = this.requestStates.get(normalizedTicker);
    if (requestState?.inFlightPromise) {
      log('Request already in-flight for', normalizedTicker, '- returning existing promise');
      return requestState.inFlightPromise;
    }

    // Check minimum request interval
    if (requestState && now - requestState.lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
      const waitTime = MIN_REQUEST_INTERVAL_MS - (now - requestState.lastRequestTime);
      log('Request spacing enforced for', normalizedTicker, '- waiting', Math.round(waitTime / 1000), 's');
      
      // Return cached if available, otherwise wait
      if (cached) {
        return cached.result;
      }
      // Wait for minimum interval
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Create new request
    log('Executing new request for', normalizedTicker);
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
        log('Rate limit detected for', normalizedTicker);
        return this.handleRateLimit(normalizedTicker, result);
      }

      // Cache successful results
      if (!isErrorResult(result)) {
        log('Caching successful result for', normalizedTicker);
        this.cache.set(normalizedTicker, {
          result,
          timestamp: Date.now(),
        });
        // Clear any retry state on success
        this.clearRetryState(normalizedTicker);
      } else {
        log('Error result for', normalizedTicker, '- errorCode:', result.errorCode);
      }

      return result;
    } catch (error) {
      log('Request failed with exception for', normalizedTicker, ':', error);
      // Clear in-flight on error
      const state = this.requestStates.get(normalizedTicker);
      if (state) {
        state.inFlightPromise = null;
      }
      throw error;
    }
  }

  private async executeRequest(ticker: string): Promise<MarketDataResult | MarketDataError> {
    // Track request details for diagnostics
    this.lastRequestDetails = {
      ticker,
      url: `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&...`,
      timestamp: Date.now(),
    };
    
    const result = await fetchMarketData(ticker);
    
    // Type guard for error result
    const isError = 'error' in result;
    
    // Track response details for diagnostics
    if (isError) {
      // Cast to MarketDataError for type safety
      const errorResult = result as MarketDataError;
      this.lastResponseDetails = {
        status: `Error: ${errorResult.errorCode}`,
        bodyPreview: errorResult.error || 'Unknown error',
        timestamp: Date.now(),
      };
    } else {
      // Cast to MarketDataResult for type safety
      const successResult = result as MarketDataResult;
      this.lastResponseDetails = {
        status: 'Success',
        bodyPreview: `${successResult.pricePoints.length} price points`,
        timestamp: Date.now(),
      };
    }
    
    return result;
  }

  private async handleRateLimit(ticker: string, error: MarketDataError): Promise<MarketDataError> {
    let retryState = this.retryStates.get(ticker);
    
    if (!retryState) {
      // Initialize retry state
      retryState = {
        attemptCount: 0,
        nextRetryTime: null,
        timeoutId: null,
      };
      this.retryStates.set(ticker, retryState);
    }

    retryState.attemptCount += 1;
    log('Rate limit retry attempt', retryState.attemptCount, 'of', MAX_RETRIES, 'for', ticker);

    if (retryState.attemptCount > MAX_RETRIES) {
      // Exhausted retries
      log('Max retries exhausted for', ticker);
      this.clearRetryState(ticker);
      return {
        ...error,
        error: 'Rate limit reached. Please wait a few minutes before trying again.',
        isRateLimited: false, // Mark as not rate limited anymore to stop retry loop
      };
    }

    // Calculate backoff delay using the current attempt count
    const delay = calculateBackoffDelay(retryState.attemptCount);
    retryState.nextRetryTime = Date.now() + delay;
    this.retryStates.set(ticker, retryState);
    
    log('Scheduled retry for', ticker, 'in', Math.round(delay / 1000), 's (attempt', retryState.attemptCount, ')');

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
      log('No retry state found for', normalizedTicker);
      return;
    }

    // Check if already exhausted retries
    if (retryState.attemptCount > MAX_RETRIES) {
      log('Max retries already exhausted for', normalizedTicker);
      return;
    }

    const delay = Math.max(0, retryState.nextRetryTime - Date.now());
    log('Scheduling retry for', normalizedTicker, 'in', Math.round(delay / 1000), 's');

    // Clear any existing timeout
    if (retryState.timeoutId) {
      clearTimeout(retryState.timeoutId);
    }

    retryState.timeoutId = setTimeout(async () => {
      log('Executing scheduled retry for', normalizedTicker, '(attempt', retryState.attemptCount, ')');
      
      // Execute the retry by calling executeRequest directly to avoid incrementing attempt count again
      try {
        const result = await this.executeRequest(normalizedTicker);
        
        // Type guard for error result
        const isErrorResult = (r: MarketDataResult | MarketDataError): r is MarketDataError => {
          return 'error' in r;
        };

        if (isErrorResult(result) && result.isRateLimited) {
          // Still rate limited, handle it
          const updatedError = await this.handleRateLimit(normalizedTicker, result);
          onRetry(updatedError);
        } else if (isErrorResult(result)) {
          // Different error
          this.clearRetryState(normalizedTicker);
          onRetry(result);
        } else {
          // Success
          this.cache.set(normalizedTicker, {
            result,
            timestamp: Date.now(),
          });
          this.clearRetryState(normalizedTicker);
          onRetry(result);
        }
      } catch (error) {
        log('Retry failed with exception for', normalizedTicker, ':', error);
        this.clearRetryState(normalizedTicker);
      }
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
   * Get diagnostic data for debugging
   */
  getDiagnostics(): DiagnosticData {
    const now = Date.now();
    const cacheEntries = Array.from(this.cache.entries()).map(([ticker, entry]) => ({
      ticker,
      age: Math.round((now - entry.timestamp) / 1000),
      ttlRemaining: Math.round((CACHE_TTL_MS - (now - entry.timestamp)) / 1000),
    }));

    const retryHistory = Array.from(this.retryStates.entries()).map(([ticker, state]) => ({
      ticker,
      attemptCount: state.attemptCount,
      nextRetryTime: state.nextRetryTime,
      backoffDelay: state.nextRetryTime ? Math.round((state.nextRetryTime - now) / 1000) : null,
    }));

    return {
      lastRequest: this.lastRequestDetails,
      lastResponse: this.lastResponseDetails,
      cacheStats: {
        entries: this.cache.size,
        hits: this.cacheHits,
        misses: this.cacheMisses,
        cacheEntries,
      },
      retryHistory,
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
    log('Cleared retry state for', ticker);
  }

  /**
   * Clear all cache and state (e.g., on logout)
   */
  clearAll(): void {
    log('Clearing all cache and state');
    this.cache.clear();
    this.requestStates.clear();
    for (const [ticker] of this.retryStates) {
      this.clearRetryState(ticker);
    }
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// Singleton instance
export const marketDataClient = new MarketDataClient();
