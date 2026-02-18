export function computePotentialProfit(
  entryPrice: number,
  takeProfitPrice: number,
  positionSize: number
): number {
  return Math.abs(takeProfitPrice - entryPrice) * positionSize;
}

export function computePotentialLoss(
  entryPrice: number,
  stopLossPrice: number,
  positionSize: number
): number {
  return Math.abs(entryPrice - stopLossPrice) * positionSize;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
