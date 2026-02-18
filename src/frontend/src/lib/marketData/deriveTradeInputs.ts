/**
 * Derive trade input defaults from fetched market data
 */

import type { MarketDataResult } from './types';
import type { IndicatorData } from '../indicators';

export interface DerivedTradeInputs {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}

export function deriveTradeInputs(
  marketData: MarketDataResult,
  indicators: IndicatorData
): DerivedTradeInputs {
  const { latestPrice } = marketData;
  const { support, resistance } = indicators;

  // Default to a conservative approach:
  // Entry at current price
  // Stop loss at support (or 2% below if no support)
  // Take profit at resistance (or 3% above if no resistance)
  
  const defaultStopLossPercent = 0.02; // 2%
  const defaultTakeProfitPercent = 0.03; // 3%

  const stopLoss = support && support < latestPrice
    ? support
    : latestPrice * (1 - defaultStopLossPercent);

  const takeProfit = resistance && resistance > latestPrice
    ? resistance
    : latestPrice * (1 + defaultTakeProfitPercent);

  return {
    entryPrice: latestPrice,
    stopLoss: Math.max(0.01, stopLoss), // Ensure positive
    takeProfit: Math.max(latestPrice * 1.01, takeProfit), // Ensure above entry
  };
}
