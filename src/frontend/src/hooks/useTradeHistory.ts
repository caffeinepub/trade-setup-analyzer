import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { TradeAnalysis } from '../backend';

export function useGetTradeHistory() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<TradeAnalysis[]>({
    queryKey: ['tradeHistory'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      try {
        return await actor.getTradeHistory();
      } catch (error: any) {
        if (error.message?.includes('No trade history found')) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetTradeById(tradeId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<TradeAnalysis | null>({
    queryKey: ['trade', tradeId?.toString()],
    queryFn: async () => {
      if (!actor || !tradeId) return null;
      return actor.getTradeById(tradeId);
    },
    enabled: !!actor && !actorFetching && tradeId !== null,
  });
}
