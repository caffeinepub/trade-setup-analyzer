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

/**
 * Validate API key presence and format
 */
export function validateApiKey(): { valid: boolean; error?: string } {
  const key = MARKET_DATA_CONFIG.apiKey;
  
  if (!key || key.trim() === '') {
    return {
      valid: false,
      error: 'API key is missing. Please configure MARKET_DATA_API_KEY.',
    };
  }
  
  if (key.length < 3) {
    return {
      valid: false,
      error: 'API key appears to be invalid (too short).',
    };
  }
  
  return { valid: true };
}
