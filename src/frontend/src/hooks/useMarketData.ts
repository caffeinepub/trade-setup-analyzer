/**
 * Market data fetch state management hook
 */

import { useState, useCallback } from 'react';
import { fetchMarketData } from '../lib/marketData/fetchMarketData';
import type { MarketDataResult, MarketDataError } from '../lib/marketData/types';

export type MarketDataStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MarketDataState {
  status: MarketDataStatus;
  data: MarketDataResult | null;
  error: string | null;
  lastRefreshTime: Date | null;
}

export function useMarketData() {
  const [state, setState] = useState<MarketDataState>({
    status: 'idle',
    data: null,
    error: null,
    lastRefreshTime: null,
  });

  const fetchData = useCallback(async (ticker: string) => {
    if (!ticker.trim()) {
      setState({
        status: 'error',
        data: null,
        error: 'Please enter a ticker symbol',
        lastRefreshTime: null,
      });
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'loading',
      error: null,
    }));

    const result = await fetchMarketData(ticker);

    if ('error' in result) {
      setState({
        status: 'error',
        data: null,
        error: result.error || 'An unknown error occurred',
        lastRefreshTime: new Date(),
      });
    } else {
      setState({
        status: 'success',
        data: result,
        error: null,
        lastRefreshTime: new Date(),
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      data: null,
      error: null,
      lastRefreshTime: null,
    });
  }, []);

  return {
    ...state,
    fetchData,
    reset,
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isIdle: state.status === 'idle',
  };
}
