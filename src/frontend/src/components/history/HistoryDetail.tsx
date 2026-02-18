import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ArrowLeft, TrendingUp, DollarSign, Target, Shield } from 'lucide-react';
import { computePotentialProfit, computePotentialLoss, formatCurrency } from '../../lib/tradeMath';
import type { TradeAnalysis } from '../../backend';

interface HistoryDetailProps {
  trade: TradeAnalysis;
  onBack: () => void;
}

export default function HistoryDetail({ trade, onBack }: HistoryDetailProps) {
  const date = new Date(Number(trade.timestamp) / 1000000);
  const direction =
    trade.inputData.entryPrice > trade.inputData.stopLossPrice ? 'LONG' : 'SHORT';

  const potentialProfit = computePotentialProfit(
    trade.inputData.entryPrice,
    trade.inputData.takeProfitPrice,
    trade.result.positionSize
  );

  const potentialLoss = computePotentialLoss(
    trade.inputData.entryPrice,
    trade.inputData.stopLossPrice,
    trade.result.positionSize
  );

  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="ghost" className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to History
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <TrendingUp className="h-6 w-6" />
                {trade.ticker}
              </CardTitle>
              <CardDescription>
                {direction} Position • {date.toLocaleDateString()} at {date.toLocaleTimeString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Input Parameters
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entry Price:</span>
                  <span className="font-mono">${trade.inputData.entryPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Stop Loss:</span>
                  <span className="font-mono">${trade.inputData.stopLossPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Take Profit:</span>
                  <span className="font-mono">${trade.inputData.takeProfitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Risk Amount:</span>
                  <span className="font-mono">${trade.inputData.riskAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Analysis Results
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Position Size:</span>
                  <span className="font-mono font-semibold">
                    {trade.result.positionSize.toFixed(2)} shares
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Risk:Reward:</span>
                  <span className="font-mono font-semibold text-chart-1">
                    1:{trade.result.riskRewardRatio.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-chart-2/10 border border-chart-2/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-chart-2" />
                <span className="text-sm font-medium">Potential Profit</span>
              </div>
              <span className="font-bold text-chart-2">{formatCurrency(potentialProfit)}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Potential Loss</span>
              </div>
              <span className="font-bold text-destructive">{formatCurrency(potentialLoss)}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Explanation
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {trade.result.explanation}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
