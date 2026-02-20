/**
 * Market data types for frontend display and processing
 */

export interface PricePoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataResult {
  ticker: string;
  latestPrice: number;
  timestamp: string;
  isRealtime: boolean; // true if real-time, false if last close
  pricePoints: PricePoint[];
  provider: string;
  error?: string;
}

export type MarketDataErrorCode = 'rate_limit' | 'invalid_ticker' | 'network_error' | 'timeout' | 'no_data' | 'api_error' | 'config_error' | 'unknown';

export interface MarketDataError {
  ticker: string;
  error: string;
  provider: string;
  errorCode: MarketDataErrorCode;
  isRateLimited: boolean;
  rawResponse?: string;
}
