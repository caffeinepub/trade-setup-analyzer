/**
 * Market data fetch state management hook with retry and cooldown support
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { marketDataClient } from '../lib/marketData/marketDataClient';
import type { MarketDataResult, MarketDataError } from '../lib/marketData/types';
import type { DiagnosticData } from '../lib/marketData/marketDataClient';
import { hasUrlParam } from '../lib/urlParams';

export type MarketDataStatus = 'idle' | 'loading' | 'success' | 'error' | 'cooldown';

export interface MarketDataState {
  status: MarketDataStatus;
  data: MarketDataResult | null;
  error: MarketDataError | null;
  lastRefreshTime: Date | null;
  cooldownSecondsRemaining: number | null;
  diagnostics?: DiagnosticData;
}

const MAX_TOTAL_RETRY_DURATION_MS = 120_000; // 2 minutes

export function useMarketData() {
  const [state, setState] = useState<MarketDataState>({
    status: 'idle',
    data: null,
    error: null,
    lastRefreshTime: null,
    cooldownSecondsRemaining: null,
  });

  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTickerRef = useRef<string>('');
  const retryStartTimeRef = useRef<number | null>(null);
  const debugMode = hasUrlParam('debug', 'market-data');

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const startCooldownTimer = useCallback((ticker: string, nextRetryTime: number) => {
    // Clear any existing interval
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    const updateCooldown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((nextRetryTime - now) / 1000));

      if (remaining <= 0) {
        // Cooldown expired, clear interval
        if (cooldownIntervalRef.current) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
        }
      } else {
        setState(prev => ({
          ...prev,
          cooldownSecondsRemaining: remaining,
          diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
        }));
      }
    };

    // Update immediately
    updateCooldown();

    // Update every second
    cooldownIntervalRef.current = setInterval(updateCooldown, 1000);
  }, [debugMode]);

  const fetchData = useCallback(async (ticker: string) => {
    if (!ticker.trim()) {
      setState({
        status: 'error',
        data: null,
        error: {
          ticker: '',
          error: 'Please enter a ticker symbol',
          provider: 'Yahoo Finance',
          errorCode: 'invalid_ticker',
          isRateLimited: false,
        },
        lastRefreshTime: null,
        cooldownSecondsRemaining: null,
        diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
      });
      return;
    }

    currentTickerRef.current = ticker;
    retryStartTimeRef.current = Date.now(); // Track when retry sequence started

    setState(prev => ({
      ...prev,
      status: 'loading',
      error: null,
      cooldownSecondsRemaining: null,
      diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
    }));

    const result = await marketDataClient.fetch(ticker);

    // Type guard for error result
    const isErrorResult = (r: MarketDataResult | MarketDataError): r is MarketDataError => {
      return 'error' in r && !('latestPrice' in r);
    };

    // Handle rate limit with cooldown
    if (isErrorResult(result) && result.isRateLimited) {
      const retryState = marketDataClient.getRetryState(ticker);
      
      if (retryState && retryState.nextRetryTime) {
        const cooldownSeconds = Math.ceil((retryState.nextRetryTime - Date.now()) / 1000);
        
        setState({
          status: 'cooldown',
          data: null,
          error: result,
          lastRefreshTime: new Date(),
          cooldownSecondsRemaining: cooldownSeconds,
          diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
        });

        // Start cooldown timer
        startCooldownTimer(ticker, retryState.nextRetryTime);

        // Schedule automatic retry with timeout check
        marketDataClient.scheduleRetry(ticker, (retryResult) => {
          // Only update if still on the same ticker
          if (currentTickerRef.current !== ticker) {
            return;
          }

          // Check if total retry duration exceeded
          const elapsedTime = Date.now() - (retryStartTimeRef.current || 0);
          if (elapsedTime > MAX_TOTAL_RETRY_DURATION_MS) {
            setState({
              status: 'error',
              data: null,
              error: {
                ticker,
                error: 'Rate limit retries exhausted. Please try again later.',
                provider: 'Yahoo Finance',
                errorCode: 'rate_limit',
                isRateLimited: false,
              },
              lastRefreshTime: new Date(),
              cooldownSecondsRemaining: null,
              diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
            });
            return;
          }

          const isRetryError = isErrorResult(retryResult);
          
          if (isRetryError && retryResult.isRateLimited) {
            // Still rate limited, continue cooldown
            const newRetryState = marketDataClient.getRetryState(ticker);
            if (newRetryState && newRetryState.nextRetryTime) {
              startCooldownTimer(ticker, newRetryState.nextRetryTime);
            }
          } else if (isRetryError) {
            // Other error
            setState({
              status: 'error',
              data: null,
              error: retryResult,
              lastRefreshTime: new Date(),
              cooldownSecondsRemaining: null,
              diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
            });
          } else {
            // Success
            setState({
              status: 'success',
              data: retryResult,
              error: null,
              lastRefreshTime: new Date(),
              cooldownSecondsRemaining: null,
              diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
            });
          }
        });
      }
      return;
    }

    // Handle other errors
    if (isErrorResult(result)) {
      setState({
        status: 'error',
        data: null,
        error: result,
        lastRefreshTime: new Date(),
        cooldownSecondsRemaining: null,
        diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
      });
      return;
    }

    // Success
    setState({
      status: 'success',
      data: result,
      error: null,
      lastRefreshTime: new Date(),
      cooldownSecondsRemaining: null,
      diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
    });
  }, [debugMode, startCooldownTimer]);

  return {
    ...state,
    fetchData,
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isCooldown: state.status === 'cooldown',
    isIdle: state.status === 'idle',
  };
}
