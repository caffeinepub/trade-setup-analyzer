import type { PricePoint } from './marketData/types';

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  sma20?: number;
  support?: number;
  resistance?: number;
}

export function computeSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
  return sum / period;
}

export function computeSupport(priceData: PriceData[], lookback: number = 20): number | null {
  if (priceData.length < lookback) return null;
  const recentLows = priceData.slice(-lookback).map((d) => d.low);
  return Math.min(...recentLows);
}

export function computeResistance(priceData: PriceData[], lookback: number = 20): number | null {
  if (priceData.length < lookback) return null;
  const recentHighs = priceData.slice(-lookback).map((d) => d.high);
  return Math.max(...recentHighs);
}

export function computeIndicators(priceData: PriceData[]): IndicatorData {
  const closePrices = priceData.map((d) => d.close);
  
  return {
    sma20: computeSMA(closePrices, 20) || undefined,
    support: computeSupport(priceData, 20) || undefined,
    resistance: computeResistance(priceData, 20) || undefined,
  };
}

// Compute indicators from market data price points
export function computeIndicatorsFromMarketData(pricePoints: PricePoint[]): IndicatorData {
  const priceData: PriceData[] = pricePoints.map(point => ({
    date: point.timestamp,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume,
  }));
  
  return computeIndicators(priceData);
}
