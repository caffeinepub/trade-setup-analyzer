import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { TradeSetupResult } from '../backend';

interface AnalyzeTradeParams {
  ticker: string;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskAmount: number;
}

export function useAnalyzeTrade() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation<TradeSetupResult, Error, AnalyzeTradeParams>({
    mutationFn: async (params) => {
      if (!actor) throw new Error('Actor not available');
      
      return actor.analyzeTrade(
        params.ticker,
        params.entryPrice,
        params.stopLossPrice,
        params.takeProfitPrice,
        params.riskAmount
      );
    },
    onSuccess: () => {
      // Invalidate trade history to refresh the list
      queryClient.invalidateQueries({ queryKey: ['tradeHistory'] });
    },
  });
}
