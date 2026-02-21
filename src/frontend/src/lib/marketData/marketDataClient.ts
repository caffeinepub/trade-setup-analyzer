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
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=5m&range=1d`,
      timestamp: Date.now(),
    };
    
    const result = await fetchMarketData(ticker);
    
    // Type guard for error result
    const isError = 'error' in result;
    
    // Track response details for diagnostics
    if (isError) {
      const errorResult = result as MarketDataError;
      this.lastResponseDetails = {
        status: `error: ${errorResult.errorCode}`,
        bodyPreview: errorResult.error,
        timestamp: Date.now(),
      };
    } else {
      const successResult = result as MarketDataResult;
      this.lastResponseDetails = {
        status: 'success',
        bodyPreview: `${successResult.pricePoints.length} price points, latest: $${successResult.latestPrice}`,
        timestamp: Date.now(),
      };
    }
    
    return result;
  }

  private handleRateLimit(ticker: string, error: MarketDataError): MarketDataError {
    let retryState = this.retryStates.get(ticker);
    
    if (!retryState) {
      retryState = {
        attemptCount: 0,
        nextRetryTime: null,
        timeoutId: null,
      };
      this.retryStates.set(ticker, retryState);
    }

    // Increment attempt count
    retryState.attemptCount += 1;
    log('Rate limit retry attempt', retryState.attemptCount, 'for', ticker);

    // Check if max retries exceeded
    if (retryState.attemptCount > MAX_RETRIES) {
      log('Max retries exceeded for', ticker);
      this.clearRetryState(ticker);
      return {
        ...error,
        error: 'Rate limit retries exhausted. Please try again later.',
        isRateLimited: false,
      };
    }

    // Calculate backoff delay
    const backoffDelay = calculateBackoffDelay(retryState.attemptCount);
    retryState.nextRetryTime = Date.now() + backoffDelay;
    
    log('Scheduling retry for', ticker, 'in', Math.round(backoffDelay / 1000), 'seconds');

    return error;
  }

  /**
   * Schedule automatic retry after rate limit cooldown
   */
  scheduleRetry(ticker: string, callback: (result: MarketDataResult | MarketDataError) => void): void {
    const retryState = this.retryStates.get(ticker);
    
    if (!retryState || !retryState.nextRetryTime) {
      log('No retry state for', ticker);
      return;
    }

    // Clear any existing timeout
    if (retryState.timeoutId) {
      clearTimeout(retryState.timeoutId);
    }

    const delay = Math.max(0, retryState.nextRetryTime - Date.now());
    log('Scheduling retry for', ticker, 'in', Math.round(delay / 1000), 'seconds');

    retryState.timeoutId = setTimeout(async () => {
      log('Executing scheduled retry for', ticker);
      const result = await this.fetch(ticker);
      callback(result);
    }, delay);
  }

  /**
   * Get retry state for a ticker (for UI display)
   */
  getRetryState(ticker: string): RetryState | null {
    return this.retryStates.get(normalizeTicker(ticker)) || null;
  }

  /**
   * Clear retry state for a ticker
   */
  private clearRetryState(ticker: string): void {
    const retryState = this.retryStates.get(ticker);
    if (retryState?.timeoutId) {
      clearTimeout(retryState.timeoutId);
    }
    this.retryStates.delete(ticker);
    log('Cleared retry state for', ticker);
  }

  /**
   * Get diagnostic data for debugging
   */
  getDiagnostics(): DiagnosticData {
    const now = Date.now();
    const cacheEntries = Array.from(this.cache.entries()).map(([ticker, entry]) => ({
      ticker,
      age: Math.round((now - entry.timestamp) / 1000),
      ttlRemaining: Math.max(0, Math.round((CACHE_TTL_MS - (now - entry.timestamp)) / 1000)),
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
}

// Export singleton instance
export const marketDataClient = new MarketDataClient();
