/**
 * Market data provider configuration
 * Centralized configuration for external market data API
 */

export const MARKET_DATA_CONFIG = {
  // Alpha Vantage free API - provides real-time and historical stock data
  // Free tier: 25 requests/day, 5 requests/minute
  baseUrl: 'https://www.alphavantage.co/query',
  provider: 'Alpha Vantage',
  // Demo API key - users should replace with their own from https://www.alphavantage.co/support/#api-key
  apiKey: 'demo',
  rateLimit: {
    requestsPerMinute: 5,
    requestsPerDay: 25,
  },
} as const;

export const MARKET_DATA_NOTES = {
  freeApiLimitations: 'Free API tier has rate limits. For production use, obtain your own API key from Alpha Vantage.',
  dataDelay: 'Data may be delayed by 15 minutes for free tier users.',
  supportedMarkets: 'Primarily US stock markets (NYSE, NASDAQ). Limited international coverage.',
};
