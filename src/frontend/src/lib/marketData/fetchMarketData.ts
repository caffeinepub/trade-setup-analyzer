/**
 * Market data fetch helper
 * Fetches recent price series from Alpha Vantage API
 */

import { MARKET_DATA_CONFIG } from './config';
import type { MarketDataResult, MarketDataError, PricePoint } from './types';

export async function fetchMarketData(ticker: string): Promise<MarketDataResult | MarketDataError> {
  // Validate ticker input
  const cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker || !/^[A-Z]{1,5}$/.test(cleanTicker)) {
    return {
      ticker: cleanTicker,
      error: 'Invalid ticker symbol. Please enter a valid stock symbol (e.g., AAPL, MSFT).',
      provider: MARKET_DATA_CONFIG.provider,
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

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Check for API error messages
    if (data['Error Message']) {
      return {
        ticker: cleanTicker,
        error: `Invalid ticker symbol "${cleanTicker}". Please verify the symbol is correct.`,
        provider: MARKET_DATA_CONFIG.provider,
      };
    }

    if (data['Note']) {
      return {
        ticker: cleanTicker,
        error: 'API rate limit reached. Please wait a moment and try again.',
        provider: MARKET_DATA_CONFIG.provider,
      };
    }

    if (data['Information']) {
      return {
        ticker: cleanTicker,
        error: 'API rate limit reached. Please wait a moment and try again.',
        provider: MARKET_DATA_CONFIG.provider,
      };
    }

    // Parse time series data
    const timeSeries = data['Time Series (5min)'];
    if (!timeSeries || Object.keys(timeSeries).length === 0) {
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

    if (pricePoints.length === 0) {
      return {
        ticker: cleanTicker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
      };
    }

    // Get latest price point
    const latest = pricePoints[pricePoints.length - 1];

    return {
      ticker: cleanTicker,
      latestPrice: latest.close,
      timestamp: latest.timestamp,
      isRealtime: true,
      pricePoints,
      provider: MARKET_DATA_CONFIG.provider,
    };
  } catch (error) {
    console.error('Market data fetch error:', error);
    return {
      ticker: cleanTicker,
      error: error instanceof Error ? error.message : 'Failed to fetch market data. Please try again.',
      provider: MARKET_DATA_CONFIG.provider,
    };
  }
}

async function fetchDailyData(ticker: string): Promise<MarketDataResult | MarketDataError> {
  try {
    const url = new URL(MARKET_DATA_CONFIG.baseUrl);
    url.searchParams.append('function', 'TIME_SERIES_DAILY');
    url.searchParams.append('symbol', ticker);
    url.searchParams.append('outputsize', 'compact');
    url.searchParams.append('apikey', MARKET_DATA_CONFIG.apiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data['Error Message'] || data['Note'] || data['Information']) {
      return {
        ticker,
        error: 'Unable to fetch market data. Please verify the ticker symbol and try again.',
        provider: MARKET_DATA_CONFIG.provider,
      };
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries || Object.keys(timeSeries).length === 0) {
      return {
        ticker,
        error: 'No price data available for this ticker.',
        provider: MARKET_DATA_CONFIG.provider,
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

    const latest = pricePoints[pricePoints.length - 1];

    return {
      ticker,
      latestPrice: latest.close,
      timestamp: latest.timestamp,
      isRealtime: false, // Daily data is last close, not real-time
      pricePoints,
      provider: MARKET_DATA_CONFIG.provider,
    };
  } catch (error) {
    return {
      ticker,
      error: 'Failed to fetch daily market data. Please try again.',
      provider: MARKET_DATA_CONFIG.provider,
    };
  }
}
