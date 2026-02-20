/**
 * Market data fetch helper
 * Fetches recent price series from Alpha Vantage API
 */

import { MARKET_DATA_CONFIG, validateApiKey } from './config';
import type { MarketDataResult, MarketDataError, PricePoint } from './types';

const DEBUG = false; // Set to true for verbose logging

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[MarketData:fetch]', ...args);
  }
}

function logError(...args: any[]) {
  console.error('[MarketData:fetch]', ...args);
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

export async function fetchMarketData(ticker: string): Promise<MarketDataResult | MarketDataError> {
  log('Starting fetch for ticker:', ticker);
  
  // Validate API key before making request
  const apiKeyValidation = validateApiKey();
  if (!apiKeyValidation.valid) {
    logError('API key validation failed:', apiKeyValidation.error);
    return {
      ticker: ticker.trim().toUpperCase(),
      error: apiKeyValidation.error || 'API key configuration error',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'config_error',
      isRateLimited: false,
    };
  }
  
  // Validate ticker input
  const cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker || !/^[A-Z]{1,5}$/.test(cleanTicker)) {
    log('Invalid ticker format:', cleanTicker);
    return {
      ticker: cleanTicker,
      error: 'Invalid ticker symbol. Please enter a valid stock symbol (e.g., AAPL, MSFT).',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'invalid_ticker',
      isRateLimited: false,
    };
  }

  try {
    // Fetch intraday data (5-minute intervals, compact output = last 100 data points)
    const url = new URL(MARKET_DATA_CONFIG.baseUrl);
    url.searchParams.append('function', 'TIME_SERIES_INTRADAY');
    url.searchParams.append('symbol', cleanTicker);
    url.searchParams.append('interval', '5min');
    url.searchParams.append('outputsize', 'compact');
    url.searchParams.append('apikey', MARKET_DATA_CONFIG.apiKey);

    // Log URL without exposing API key
    const logUrl = url.toString().replace(MARKET_DATA_CONFIG.apiKey, '***');
    log('Request URL:', logUrl);

    // Create timeout controller (15 seconds)
    const controller = createTimeoutController(15000);
    
    const startTime = Date.now();
    const response = await fetch(url.toString(), { signal: controller.signal });
    const fetchDuration = Date.now() - startTime;
    
    log('Response received in', fetchDuration, 'ms, status:', response.status);
    log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      logError('HTTP error! status:', response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    log('Response data keys:', Object.keys(data));
    log('Response data preview:', JSON.stringify(data).substring(0, 500));

    // Check for API error messages
    if (data['Error Message']) {
      log('API returned Error Message:', data['Error Message']);
      return {
        ticker: cleanTicker,
        error: `Invalid ticker symbol "${cleanTicker}". Please verify the symbol is correct.`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'invalid_ticker',
        isRateLimited: false,
        rawResponse: JSON.stringify(data).substring(0, 500),
      };
    }

    // Rate limit detection
    if (data['Note']) {
      log('API returned Note (rate limit):', data['Note']);
      return {
        ticker: cleanTicker,
        error: 'API rate limit reached. Retrying automatically...',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'rate_limit',
        isRateLimited: true,
        rawResponse: data['Note'],
      };
    }

    if (data['Information']) {
      log('API returned Information (rate limit):', data['Information']);
      return {
        ticker: cleanTicker,
        error: 'API rate limit reached. Retrying automatically...',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'rate_limit',
        isRateLimited: true,
        rawResponse: data['Information'],
      };
    }

    // Parse time series data
    const timeSeries = data['Time Series (5min)'];
    if (!timeSeries || Object.keys(timeSeries).length === 0) {
      log('No intraday data, falling back to daily data');
      // Fallback to daily data if intraday not available
      return fetchDailyData(cleanTicker);
    }

    // Convert to array of price points
    const pricePoints: PricePoint[] = Object.entries(timeSeries)
      .map(([timestamp, values]: [string, any]) => ({
        timestamp,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume']),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    log('Parsed', pricePoints.length, 'price points');

    if (pricePoints.length === 0) {
      logError('No price data available after parsing');
      return {
        ticker: cleanTicker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: JSON.stringify(data).substring(0, 500),
      };
    }

    // Get latest price point
    const latest = pricePoints[pricePoints.length - 1];
    log('Latest price:', latest.close, 'at', latest.timestamp);

    return {
      ticker: cleanTicker,
      latestPrice: latest.close,
      timestamp: latest.timestamp,
      isRealtime: true,
      pricePoints,
      provider: MARKET_DATA_CONFIG.provider,
    };
  } catch (error) {
    if (error instanceof Error) {
      logError('Fetch error:', error.message, error.name);
      
      // Check if it's a timeout error
      if (error.name === 'AbortError') {
        return {
          ticker: cleanTicker,
          error: 'Request timed out. Please check your connection and try again.',
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'timeout',
          isRateLimited: false,
        };
      }
      
      return {
        ticker: cleanTicker,
        error: error.message || 'Failed to fetch market data. Please try again.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'network_error',
        isRateLimited: false,
      };
    }
    
    logError('Unknown error:', error);
    return {
      ticker: cleanTicker,
      error: 'Failed to fetch market data. Please try again.',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'network_error',
      isRateLimited: false,
    };
  }
}

async function fetchDailyData(ticker: string): Promise<MarketDataResult | MarketDataError> {
  log('Fetching daily data for:', ticker);
  
  try {
    const url = new URL(MARKET_DATA_CONFIG.baseUrl);
    url.searchParams.append('function', 'TIME_SERIES_DAILY');
    url.searchParams.append('symbol', ticker);
    url.searchParams.append('outputsize', 'compact');
    url.searchParams.append('apikey', MARKET_DATA_CONFIG.apiKey);

    const logUrl = url.toString().replace(MARKET_DATA_CONFIG.apiKey, '***');
    log('Daily request URL:', logUrl);

    const controller = createTimeoutController(15000);
    const response = await fetch(url.toString(), { signal: controller.signal });
    
    log('Daily response status:', response.status);
    
    if (!response.ok) {
      logError('Daily HTTP error! status:', response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    log('Daily response data keys:', Object.keys(data));

    // Rate limit detection in daily fallback
    if (data['Note'] || data['Information']) {
      log('Daily API rate limit detected');
      return {
        ticker,
        error: 'API rate limit reached. Retrying automatically...',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'rate_limit',
        isRateLimited: true,
        rawResponse: data['Note'] || data['Information'],
      };
    }

    if (data['Error Message']) {
      log('Daily API error:', data['Error Message']);
      return {
        ticker,
        error: 'Unable to fetch market data. Please verify the ticker symbol and try again.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'invalid_ticker',
        isRateLimited: false,
        rawResponse: data['Error Message'],
      };
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries || Object.keys(timeSeries).length === 0) {
      logError('No daily data available');
      return {
        ticker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: JSON.stringify(data).substring(0, 500),
      };
    }

    const pricePoints: PricePoint[] = Object.entries(timeSeries)
      .slice(0, 100)
      .map(([timestamp, values]: [string, any]) => ({
        timestamp,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume']),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    log('Parsed', pricePoints.length, 'daily price points');

    const latest = pricePoints[pricePoints.length - 1];
    log('Latest daily price:', latest.close, 'at', latest.timestamp);

    return {
      ticker,
      latestPrice: latest.close,
      timestamp: latest.timestamp,
      isRealtime: false, // Daily data is last close, not real-time
      pricePoints,
      provider: MARKET_DATA_CONFIG.provider,
    };
  } catch (error) {
    if (error instanceof Error) {
      logError('Daily fetch error:', error.message, error.name);
      
      if (error.name === 'AbortError') {
        return {
          ticker,
          error: 'Request timed out. Please check your connection and try again.',
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'timeout',
          isRateLimited: false,
        };
      }
    }
    
    logError('Daily unknown error:', error);
    return {
      ticker,
      error: 'Failed to fetch daily market data. Please try again.',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'network_error',
      isRateLimited: false,
    };
  }
}
