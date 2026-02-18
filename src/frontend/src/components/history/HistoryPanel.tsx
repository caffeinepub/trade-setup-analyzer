import { useState } from 'react';
import { useGetTradeHistory } from '../../hooks/useTradeHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import HistoryDetail from './HistoryDetail';
import { History, AlertCircle, TrendingUp } from 'lucide-react';
import type { TradeAnalysis } from '../../backend';

export default function HistoryPanel() {
  const { data: history, isLoading, error } = useGetTradeHistory();
  const [selectedTrade, setSelectedTrade] = useState<TradeAnalysis | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Analysis History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Analysis History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load history'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Analysis History
          </CardTitle>
          <CardDescription>Your past trade analyses will appear here</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No analyses yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run your first analysis to see it saved here
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selectedTrade) {
    return <HistoryDetail trade={selectedTrade} onBack={() => setSelectedTrade(null)} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Analysis History
        </CardTitle>
        <CardDescription>
          {history.length} {history.length === 1 ? 'analysis' : 'analyses'} saved
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {history.map((trade) => {
              const date = new Date(Number(trade.timestamp) / 1000000);
              const direction =
                trade.inputData.entryPrice > trade.inputData.stopLossPrice ? 'LONG' : 'SHORT';

              return (
                <button
                  key={trade.id.toString()}
                  onClick={() => setSelectedTrade(trade)}
                  className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-lg">{trade.ticker}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            direction === 'LONG'
                              ? 'bg-chart-2/20 text-chart-2'
                              : 'bg-destructive/20 text-destructive'
                          }`}
                        >
                          {direction}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">R:R</p>
                      <p className="font-bold text-chart-1">
                        1:{trade.result.riskRewardRatio.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
