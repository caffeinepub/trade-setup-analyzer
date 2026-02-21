/**
 * Market data provider configuration
 * Centralized configuration for external market data API
 */

export const MARKET_DATA_CONFIG = {
  // Yahoo Finance query API - provides real-time and historical stock data
  // No API key required, more generous rate limits than Alpha Vantage
  baseUrl: 'https://query1.finance.yahoo.com',
  provider: 'Yahoo Finance',
  // No API key needed for Yahoo Finance
  rateLimit: {
    // Yahoo Finance is more lenient with rate limits
    requestsPerMinute: 60,
    requestsPerDay: 2000,
  },
} as const;

export const MARKET_DATA_NOTES = {
  freeApiLimitations: 'Yahoo Finance API is free to use but intended for personal use only.',
  dataDelay: 'Data is typically real-time or with minimal delay.',
  supportedMarkets: 'Global stock markets including US (NYSE, NASDAQ), international exchanges, and major indices.',
};
