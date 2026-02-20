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
        // Cooldown expired, trigger retry
        if (cooldownIntervalRef.current) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
        }
        // The retry will be triggered by scheduleRetry
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
          provider: 'Alpha Vantage',
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
      return 'error' in r;
    };

    // Handle rate limit with cooldown
    if (isErrorResult(result) && result.isRateLimited) {
      const retryState = marketDataClient.getRetryState(ticker);
      
      if (retryState && retryState.nextRetryTime) {
        setState({
          status: 'cooldown',
          data: null,
          error: result,
          lastRefreshTime: new Date(),
          cooldownSecondsRemaining: Math.ceil((retryState.nextRetryTime - Date.now()) / 1000),
          diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
        });

        // Start cooldown timer
        startCooldownTimer(ticker, retryState.nextRetryTime);

        // Schedule automatic retry
        marketDataClient.scheduleRetry(ticker, (retryResult) => {
          // Only update if still on the same ticker
          if (currentTickerRef.current === ticker) {
            if (isErrorResult(retryResult)) {
              if (retryResult.isRateLimited) {
                // Still rate limited, continue cooldown
                const newRetryState = marketDataClient.getRetryState(ticker);
                if (newRetryState && newRetryState.nextRetryTime) {
                  setState({
                    status: 'cooldown',
                    data: null,
                    error: retryResult,
                    lastRefreshTime: new Date(),
                    cooldownSecondsRemaining: Math.ceil((newRetryState.nextRetryTime - Date.now()) / 1000),
                    diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
                  });
                  startCooldownTimer(ticker, newRetryState.nextRetryTime);
                }
              } else {
                // Different error
                setState({
                  status: 'error',
                  data: null,
                  error: retryResult,
                  lastRefreshTime: new Date(),
                  cooldownSecondsRemaining: null,
                  diagnostics: debugMode ? marketDataClient.getDiagnostics() : undefined,
                });
              }
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
  }, [startCooldownTimer, debugMode]);

  return {
    ...state,
    fetchData,
    isIdle: state.status === 'idle',
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isCooldown: state.status === 'cooldown',
  };
}
