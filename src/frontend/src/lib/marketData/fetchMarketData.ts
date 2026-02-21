/**
 * Market data fetch helper
 * Fetches recent price series from Yahoo Finance API with comprehensive error logging
 */

import { MARKET_DATA_CONFIG } from './config';
import type { MarketDataResult, MarketDataError, PricePoint } from './types';

const DEBUG = true; // Enable verbose logging for diagnostics

function log(...args: any[]) {
  if (DEBUG) {
    console.debug('[MarketData:fetch]', ...args);
  }
}

function logError(...args: any[]) {
  console.error('[MarketData:fetch]', ...args);
}

/**
 * Detect environment context
 */
function getEnvironmentInfo() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
  
  return {
    hostname,
    origin,
    isDevelopment,
    environment: isDevelopment ? 'development' : 'production',
  };
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Test helper function for console testing
 * Usage: testFetchMarketData('AAPL')
 */
export async function testFetchMarketData(ticker: string): Promise<void> {
  console.log('=== Market Data Fetch Test ===');
  console.log('Ticker:', ticker);
  console.log('Environment:', getEnvironmentInfo());
  
  const result = await fetchMarketData(ticker);
  
  if ('error' in result) {
    console.error('❌ Fetch failed:', result);
  } else {
    console.log('✅ Fetch succeeded:', result);
  }
  
  console.log('=== Test Complete ===');
}

export async function fetchMarketData(ticker: string): Promise<MarketDataResult | MarketDataError> {
  const env = getEnvironmentInfo();
  log('=== Starting fetch ===');
  log('Ticker:', ticker);
  log('Environment:', env);
  
  // Validate ticker input
  const cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker || !/^[A-Z]{1,5}$/.test(cleanTicker)) {
    log('❌ Invalid ticker format:', cleanTicker);
    return {
      ticker: cleanTicker,
      error: 'Invalid ticker symbol. Please enter a valid stock symbol (e.g., AAPL, MSFT).',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'invalid_ticker',
      isRateLimited: false,
    };
  }

  try {
    // Construct URL
    const url = new URL(`${MARKET_DATA_CONFIG.baseUrl}/v8/finance/chart/${cleanTicker}`);
    url.searchParams.append('interval', '5m'); // 5-minute intervals
    url.searchParams.append('range', '1d'); // Last 1 day of data

    const urlString = url.toString();
    log('📡 Request URL:', urlString);
    log('Request method: GET');
    log('Request headers: Accept: application/json');

    // Create timeout controller (15 seconds)
    const controller = createTimeoutController(15000);
    
    const startTime = Date.now();
    let response: Response;
    
    try {
      response = await fetch(urlString, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch (fetchError: any) {
      const fetchDuration = Date.now() - startTime;
      logError('❌ Fetch exception after', fetchDuration, 'ms');
      logError('Error name:', fetchError.name);
      logError('Error message:', fetchError.message);
      logError('Error type:', typeof fetchError);
      logError('Full error object:', fetchError);
      
      // Detect specific error types
      if (fetchError.name === 'AbortError') {
        logError('🕐 Timeout error detected');
        return {
          ticker: cleanTicker,
          error: 'Request timed out after 15 seconds. Please check your internet connection and try again.',
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'timeout',
          isRateLimited: false,
          rawResponse: `Timeout after ${fetchDuration}ms in ${env.environment} environment (${env.origin})`,
        };
      }
      
      if (fetchError.name === 'TypeError') {
        // TypeError often indicates CORS or network connectivity issues
        logError('🚫 TypeError detected - likely CORS or network issue');
        
        const isCorsError = fetchError.message.includes('CORS') || 
                           fetchError.message.includes('cross-origin') ||
                           fetchError.message.includes('Failed to fetch');
        
        if (isCorsError) {
          return {
            ticker: cleanTicker,
            error: `Browser blocked the request due to CORS policy. Yahoo Finance API cannot be accessed directly from the browser in ${env.environment} mode. This is a browser security restriction, not an application error.`,
            provider: MARKET_DATA_CONFIG.provider,
            errorCode: 'network_error',
            isRateLimited: false,
            rawResponse: `CORS error in ${env.environment} environment (${env.origin}): ${fetchError.message}`,
          };
        }
        
        return {
          ticker: cleanTicker,
          error: `Network error: ${fetchError.message}. Please check your internet connection.`,
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'network_error',
          isRateLimited: false,
          rawResponse: `Network error in ${env.environment} environment (${env.origin}): ${fetchError.message}`,
        };
      }
      
      // Generic network error
      logError('🌐 Generic network error');
      return {
        ticker: cleanTicker,
        error: `Failed to connect to market data provider: ${fetchError.message}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'network_error',
        isRateLimited: false,
        rawResponse: `Network error in ${env.environment} environment (${env.origin}): ${fetchError.message}`,
      };
    }
    
    const fetchDuration = Date.now() - startTime;
    
    log('✅ Response received in', fetchDuration, 'ms');
    log('Response status:', response.status);
    log('Response statusText:', response.statusText);
    log('Response ok:', response.ok);
    log('Response headers:', {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      server: response.headers.get('server'),
    });
    
    if (!response.ok) {
      logError('❌ HTTP error! status:', response.status, response.statusText);
      
      // Try to read response body for more details
      let responseBody = '';
      try {
        responseBody = await response.text();
        logError('Response body:', responseBody.substring(0, 500));
      } catch (bodyError) {
        logError('Could not read response body:', bodyError);
      }
      
      if (response.status === 404) {
        return {
          ticker: cleanTicker,
          error: `Invalid ticker symbol "${cleanTicker}". Please verify the symbol is correct.`,
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'invalid_ticker',
          isRateLimited: false,
          rawResponse: `HTTP 404 in ${env.environment}: ${responseBody.substring(0, 200)}`,
        };
      }
      
      if (response.status === 429) {
        return {
          ticker: cleanTicker,
          error: 'Rate limit reached. Retrying automatically...',
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'rate_limit',
          isRateLimited: true,
          rawResponse: `HTTP 429 in ${env.environment}: ${responseBody.substring(0, 200)}`,
        };
      }
      
      return {
        ticker: cleanTicker,
        error: `HTTP error ${response.status}: ${response.statusText}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'api_error',
        isRateLimited: false,
        rawResponse: `HTTP ${response.status} in ${env.environment}: ${responseBody.substring(0, 200)}`,
      };
    }

    // Parse JSON response
    let data: any;
    let rawText = '';
    
    try {
      rawText = await response.text();
      log('Response body length:', rawText.length, 'characters');
      log('Response body preview:', rawText.substring(0, 200));
      
      data = JSON.parse(rawText);
      log('✅ JSON parsed successfully');
      log('Response data keys:', Object.keys(data));
    } catch (parseError: any) {
      logError('❌ JSON parse error:', parseError.message);
      logError('Raw response text (first 500 chars):', rawText.substring(0, 500));
      
      return {
        ticker: cleanTicker,
        error: `Failed to parse response from market data provider. The API may have returned invalid data.`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'api_error',
        isRateLimited: false,
        rawResponse: `Parse error in ${env.environment}: ${parseError.message}. Body: ${rawText.substring(0, 200)}`,
      };
    }

    // Check for API errors
    if (data.chart?.error) {
      const errorMsg = data.chart.error.description || data.chart.error.code;
      logError('❌ API returned error:', errorMsg);
      log('Full error object:', data.chart.error);
      
      return {
        ticker: cleanTicker,
        error: `Unable to fetch data for "${cleanTicker}". ${errorMsg}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'invalid_ticker',
        isRateLimited: false,
        rawResponse: `API error in ${env.environment}: ${errorMsg}`,
      };
    }

    // Parse chart data
    const result = data.chart?.result?.[0];
    if (!result) {
      logError('❌ No chart result in response');
      log('Full response structure:', JSON.stringify(data).substring(0, 500));
      
      return {
        ticker: cleanTicker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: `No chart result in ${env.environment}. Response: ${JSON.stringify(data).substring(0, 200)}`,
      };
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    
    log('Timestamps count:', timestamps?.length || 0);
    log('Quote data available:', !!quote);
    
    if (!timestamps || !quote || timestamps.length === 0) {
      log('⚠️ No intraday price data, trying daily data');
      return fetchDailyData(cleanTicker);
    }

    // Convert to array of price points
    const pricePoints: PricePoint[] = timestamps
      .map((ts: number, index: number) => {
        const open = quote.open?.[index];
        const high = quote.high?.[index];
        const low = quote.low?.[index];
        const close = quote.close?.[index];
        const volume = quote.volume?.[index];
        
        // Skip data points with null values
        if (open == null || high == null || low == null || close == null) {
          return null;
        }
        
        return {
          timestamp: new Date(ts * 1000).toISOString(),
          open,
          high,
          low,
          close,
          volume: volume || 0,
        };
      })
      .filter((point): point is PricePoint => point !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    log('✅ Parsed', pricePoints.length, 'price points');

    if (pricePoints.length === 0) {
      logError('❌ No valid price data after parsing');
      return {
        ticker: cleanTicker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: `No valid price points in ${env.environment}. Raw data: ${JSON.stringify(data).substring(0, 200)}`,
      };
    }

    // Get latest price point
    const latest = pricePoints[pricePoints.length - 1];
    log('✅ Latest price:', latest.close, 'at', latest.timestamp);
    log('=== Fetch complete ===');

    return {
      ticker: cleanTicker,
      latestPrice: latest.close,
      timestamp: latest.timestamp,
      isRealtime: true,
      pricePoints,
      provider: MARKET_DATA_CONFIG.provider,
    };
  } catch (error) {
    logError('❌ Unexpected error in fetchMarketData');
    logError('Error type:', typeof error);
    logError('Error:', error);
    
    if (error instanceof Error) {
      logError('Error name:', error.name);
      logError('Error message:', error.message);
      logError('Error stack:', error.stack);
      
      return {
        ticker: cleanTicker,
        error: `Unexpected error: ${error.message}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'network_error',
        isRateLimited: false,
        rawResponse: `Unexpected error in ${env.environment}: ${error.name} - ${error.message}`,
      };
    }
    
    logError('❌ Unknown error type:', error);
    return {
      ticker: cleanTicker,
      error: 'An unexpected error occurred. Please try again.',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'network_error',
      isRateLimited: false,
      rawResponse: `Unknown error in ${env.environment}: ${String(error)}`,
    };
  }
}

async function fetchDailyData(ticker: string): Promise<MarketDataResult | MarketDataError> {
  const env = getEnvironmentInfo();
  log('=== Fetching daily data ===');
  log('Ticker:', ticker);
  
  try {
    const url = new URL(`${MARKET_DATA_CONFIG.baseUrl}/v8/finance/chart/${ticker}`);
    url.searchParams.append('interval', '1d'); // Daily intervals
    url.searchParams.append('range', '3mo'); // Last 3 months

    const urlString = url.toString();
    log('📡 Daily request URL:', urlString);

    const controller = createTimeoutController(15000);
    
    let response: Response;
    try {
      response = await fetch(urlString, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
    } catch (fetchError: any) {
      logError('❌ Daily fetch exception');
      logError('Error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return {
          ticker,
          error: 'Request timed out. Please check your connection and try again.',
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'timeout',
          isRateLimited: false,
          rawResponse: `Daily timeout in ${env.environment}`,
        };
      }
      
      if (fetchError.name === 'TypeError') {
        const isCorsError = fetchError.message.includes('CORS') || 
                           fetchError.message.includes('cross-origin') ||
                           fetchError.message.includes('Failed to fetch');
        
        if (isCorsError) {
          return {
            ticker,
            error: `Browser blocked the request due to CORS policy. Yahoo Finance API cannot be accessed directly from the browser in ${env.environment} mode.`,
            provider: MARKET_DATA_CONFIG.provider,
            errorCode: 'network_error',
            isRateLimited: false,
            rawResponse: `Daily CORS error in ${env.environment}: ${fetchError.message}`,
          };
        }
      }
      
      return {
        ticker,
        error: `Network error: ${fetchError.message}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'network_error',
        isRateLimited: false,
        rawResponse: `Daily network error in ${env.environment}: ${fetchError.message}`,
      };
    }
    
    log('✅ Daily response status:', response.status);
    
    if (!response.ok) {
      logError('❌ Daily HTTP error! status:', response.status);
      
      let responseBody = '';
      try {
        responseBody = await response.text();
        logError('Daily response body:', responseBody.substring(0, 500));
      } catch (bodyError) {
        logError('Could not read daily response body:', bodyError);
      }
      
      if (response.status === 404) {
        return {
          ticker,
          error: `Invalid ticker symbol "${ticker}". Please verify the symbol is correct.`,
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'invalid_ticker',
          isRateLimited: false,
          rawResponse: `Daily HTTP 404 in ${env.environment}`,
        };
      }
      
      if (response.status === 429) {
        return {
          ticker,
          error: 'Rate limit reached. Retrying automatically...',
          provider: MARKET_DATA_CONFIG.provider,
          errorCode: 'rate_limit',
          isRateLimited: true,
          rawResponse: `Daily HTTP 429 in ${env.environment}`,
        };
      }
      
      return {
        ticker,
        error: `HTTP error ${response.status}: ${response.statusText}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'api_error',
        isRateLimited: false,
        rawResponse: `Daily HTTP ${response.status} in ${env.environment}`,
      };
    }

    let data: any;
    let rawText = '';
    
    try {
      rawText = await response.text();
      log('Daily response body length:', rawText.length);
      data = JSON.parse(rawText);
      log('✅ Daily JSON parsed successfully');
      log('Daily response data keys:', Object.keys(data));
    } catch (parseError: any) {
      logError('❌ Daily JSON parse error:', parseError.message);
      return {
        ticker,
        error: 'Failed to parse daily data response.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'api_error',
        isRateLimited: false,
        rawResponse: `Daily parse error in ${env.environment}: ${parseError.message}`,
      };
    }

    // Check for API errors
    if (data.chart?.error) {
      const errorMsg = data.chart.error.description || data.chart.error.code;
      logError('❌ Daily API error:', errorMsg);
      return {
        ticker,
        error: `Unable to fetch data for "${ticker}". ${errorMsg}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'invalid_ticker',
        isRateLimited: false,
        rawResponse: `Daily API error in ${env.environment}: ${errorMsg}`,
      };
    }

    const result = data.chart?.result?.[0];
    if (!result) {
      logError('❌ No daily chart result');
      return {
        ticker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: `No daily chart result in ${env.environment}`,
      };
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    
    if (!timestamps || !quote || timestamps.length === 0) {
      logError('❌ No daily price data available');
      return {
        ticker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: `No daily timestamps in ${env.environment}`,
      };
    }

    const pricePoints: PricePoint[] = timestamps
      .map((ts: number, index: number) => {
        const open = quote.open?.[index];
        const high = quote.high?.[index];
        const low = quote.low?.[index];
        const close = quote.close?.[index];
        const volume = quote.volume?.[index];
        
        // Skip data points with null values
        if (open == null || high == null || low == null || close == null) {
          return null;
        }
        
        return {
          timestamp: new Date(ts * 1000).toISOString(),
          open,
          high,
          low,
          close,
          volume: volume || 0,
        };
      })
      .filter((point): point is PricePoint => point !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    log('✅ Parsed', pricePoints.length, 'daily price points');

    if (pricePoints.length === 0) {
      return {
        ticker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'no_data',
        isRateLimited: false,
        rawResponse: `No valid daily price points in ${env.environment}`,
      };
    }

    const latest = pricePoints[pricePoints.length - 1];
    log('✅ Latest daily price:', latest.close, 'at', latest.timestamp);
    log('=== Daily fetch complete ===');

    return {
      ticker,
      latestPrice: latest.close,
      timestamp: latest.timestamp,
      isRealtime: false, // Daily data is last close, not real-time
      pricePoints,
      provider: MARKET_DATA_CONFIG.provider,
    };
  } catch (error) {
    logError('❌ Unexpected error in fetchDailyData');
    logError('Error:', error);
    
    if (error instanceof Error) {
      return {
        ticker,
        error: `Unexpected error: ${error.message}`,
        provider: MARKET_DATA_CONFIG.provider,
        errorCode: 'network_error',
        isRateLimited: false,
        rawResponse: `Daily unexpected error in ${env.environment}: ${error.message}`,
      };
    }
    
    return {
      ticker,
      error: 'Failed to fetch daily market data. Please try again.',
      provider: MARKET_DATA_CONFIG.provider,
      errorCode: 'network_error',
      isRateLimited: false,
      rawResponse: `Daily unknown error in ${env.environment}`,
    };
  }
}
