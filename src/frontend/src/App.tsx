import { useState, useEffect } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useUserProfile';
import { useAnalyzeTrade } from './hooks/useTradeAnalysis';
import { useMarketData } from './hooks/useMarketData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Alert, AlertDescription } from './components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Separator } from './components/ui/separator';
import { Badge } from './components/ui/badge';
import LoginButton from './components/auth/LoginButton';
import ProfileSetupModal from './components/auth/ProfileSetupModal';
import DisclaimerGate from './components/DisclaimerGate';
import CsvUploadPanel from './components/CsvUploadPanel';
import HistoryPanel from './components/history/HistoryPanel';
import { validateNumericInput, validateRequired } from './lib/validation';
import { computePotentialProfit, computePotentialLoss, formatCurrency, formatPercentage } from './lib/tradeMath';
import { computeIndicatorsFromMarketData } from './lib/indicators';
import { deriveTradeInputs } from './lib/marketData/deriveTradeInputs';
import { TrendingUp, AlertTriangle, DollarSign, Target, Shield, RefreshCw, Activity, Clock } from 'lucide-react';
import type { IndicatorData } from './lib/indicators';

export default function App() {
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
  const { mutate: analyzeTrade, isPending, data: result, error } = useAnalyzeTrade();
  const marketData = useMarketData();

  const isAuthenticated = !!identity;
  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

  // Form state
  const [ticker, setTicker] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [riskAmount, setRiskAmount] = useState('');
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isDataDerived, setIsDataDerived] = useState(false);

  // Disclaimer acknowledgement
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleFetchLiveData = async () => {
    if (!ticker.trim()) {
      setFormErrors({ ticker: 'Please enter a ticker symbol' });
      return;
    }

    await marketData.fetchData(ticker);
  };

  // Auto-populate form when market data is successfully fetched
  useEffect(() => {
    if (marketData.isSuccess && marketData.data) {
      const computedIndicators = computeIndicatorsFromMarketData(marketData.data.pricePoints);
      setIndicators(computedIndicators);

      const derived = deriveTradeInputs(marketData.data, computedIndicators);
      
      setEntryPrice(derived.entryPrice.toFixed(2));
      setStopLossPrice(derived.stopLoss.toFixed(2));
      setTakeProfitPrice(derived.takeProfit.toFixed(2));
      setIsDataDerived(true);
      setFormErrors({});
    }
  }, [marketData.isSuccess, marketData.data]);

  const handleRefreshData = async () => {
    if (ticker.trim()) {
      const currentRisk = riskAmount; // Preserve risk amount
      await marketData.fetchData(ticker);
      setRiskAmount(currentRisk); // Restore risk amount after refresh
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!validateRequired(ticker)) {
      errors.ticker = 'Ticker symbol is required';
    }

    const entryValidation = validateNumericInput(entryPrice, 'Entry price', true);
    if (entryValidation) errors.entryPrice = entryValidation;

    const stopValidation = validateNumericInput(stopLossPrice, 'Stop loss price', true);
    if (stopValidation) errors.stopLossPrice = stopValidation;

    const takeProfitValidation = validateNumericInput(takeProfitPrice, 'Take profit price', true);
    if (takeProfitValidation) errors.takeProfitPrice = takeProfitValidation;

    const riskValidation = validateNumericInput(riskAmount, 'Risk amount', true);
    if (riskValidation) errors.riskAmount = riskValidation;

    // Additional validation: stop loss should be different from entry
    if (!errors.entryPrice && !errors.stopLossPrice) {
      const entry = parseFloat(entryPrice);
      const stop = parseFloat(stopLossPrice);
      if (entry === stop) {
        errors.stopLossPrice = 'Stop loss must be different from entry price';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAnalyze = () => {
    // Guide user to fetch live data if not done yet
    if (marketData.isIdle && !entryPrice && !stopLossPrice && !takeProfitPrice) {
      setFormErrors({
        ticker: 'Please fetch live market data first, or manually enter trade parameters',
      });
      return;
    }

    if (!validateForm()) return;

    analyzeTrade({
      ticker: ticker.toUpperCase(),
      entryPrice: parseFloat(entryPrice),
      stopLossPrice: parseFloat(stopLossPrice),
      takeProfitPrice: parseFloat(takeProfitPrice),
      riskAmount: parseFloat(riskAmount),
    });
  };

  const potentialProfit = result
    ? computePotentialProfit(
        parseFloat(entryPrice),
        parseFloat(takeProfitPrice),
        result.positionSize
      )
    : null;

  const potentialLoss = result
    ? computePotentialLoss(
        parseFloat(entryPrice),
        parseFloat(stopLossPrice),
        result.positionSize
      )
    : null;

  const profitPercentage =
    potentialProfit && riskAmount ? (potentialProfit / parseFloat(riskAmount)) * 100 : null;

  const lossPercentage =
    potentialLoss && riskAmount ? (potentialLoss / parseFloat(riskAmount)) * 100 : null;

  const direction =
    entryPrice && stopLossPrice
      ? parseFloat(entryPrice) > parseFloat(stopLossPrice)
        ? 'LONG'
        : 'SHORT'
      : null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background illustration */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'url(/assets/generated/trade-setup-bg.dim_1600x900.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/40 backdrop-blur-sm bg-background/80">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/assets/generated/trade-setup-logo.dim_512x512.png"
                alt="Trade Setup Analyzer"
                className="h-10 w-10"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight">Trade Setup Analyzer</h1>
                <p className="text-xs text-muted-foreground">Educational Trading Tool</p>
              </div>
            </div>
            <LoginButton />
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {isAuthenticated ? (
            <Tabs defaultValue="analyzer" className="space-y-6">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="analyzer" className="space-y-6">
                <DisclaimerGate
                  acknowledged={disclaimerAcknowledged}
                  onAcknowledge={() => setDisclaimerAcknowledged(true)}
                />

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Input Form */}
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Trade Parameters
                        </CardTitle>
                        <CardDescription>
                          Enter a ticker symbol and fetch live market data to auto-populate trade levels
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ticker">Ticker Symbol</Label>
                          <div className="flex gap-2">
                            <Input
                              id="ticker"
                              placeholder="e.g., AAPL"
                              value={ticker}
                              onChange={(e) => {
                                setTicker(e.target.value.toUpperCase());
                                setIsDataDerived(false);
                              }}
                              className={formErrors.ticker ? 'border-destructive' : ''}
                            />
                            <Button
                              onClick={handleFetchLiveData}
                              disabled={marketData.isLoading || !ticker.trim()}
                              variant="secondary"
                              className="shrink-0"
                            >
                              {marketData.isLoading ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Activity className="h-4 w-4 mr-2" />
                                  Fetch Live Data
                                </>
                              )}
                            </Button>
                          </div>
                          {formErrors.ticker && (
                            <p className="text-xs text-destructive">{formErrors.ticker}</p>
                          )}
                        </div>

                        {/* Live Data Status Panel */}
                        {ticker && marketData.status !== 'idle' && (
                          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Live Market Data</span>
                              </div>
                              {marketData.isSuccess && (
                                <Button
                                  onClick={handleRefreshData}
                                  disabled={marketData.isLoading}
                                  variant="ghost"
                                  size="sm"
                                >
                                  <RefreshCw className={`h-3 w-3 ${marketData.isLoading ? 'animate-spin' : ''}`} />
                                </Button>
                              )}
                            </div>

                            {marketData.isLoading && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Fetching market data...
                              </div>
                            )}

                            {marketData.isSuccess && marketData.data && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Provider:</span>
                                  <span className="font-medium">{marketData.data.provider}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Latest Price:</span>
                                  <span className="font-mono font-bold text-chart-1">
                                    ${marketData.data.latestPrice.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Status:</span>
                                  <Badge variant={marketData.data.isRealtime ? 'default' : 'secondary'} className="text-xs">
                                    {marketData.data.isRealtime ? 'Real-time' : 'Last Close'}
                                  </Badge>
                                </div>
                                {marketData.lastRefreshTime && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                                    <Clock className="h-3 w-3" />
                                    Last updated: {marketData.lastRefreshTime.toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            )}

                            {marketData.isError && marketData.error && (
                              <Alert variant="destructive" className="py-2">
                                <AlertTriangle className="h-3 w-3" />
                                <AlertDescription className="text-xs">
                                  {marketData.error}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )}

                        {isDataDerived && (
                          <Alert className="bg-chart-1/10 border-chart-1/20">
                            <Activity className="h-4 w-4 text-chart-1" />
                            <AlertDescription className="text-xs">
                              Trade levels auto-filled from live market data. You can edit these values as needed.
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="entryPrice">
                              Entry Price ($)
                              {isDataDerived && <span className="text-xs text-chart-1 ml-1">• Auto</span>}
                            </Label>
                            <Input
                              id="entryPrice"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={entryPrice}
                              onChange={(e) => {
                                setEntryPrice(e.target.value);
                                setIsDataDerived(false);
                              }}
                              className={formErrors.entryPrice ? 'border-destructive' : ''}
                            />
                            {formErrors.entryPrice && (
                              <p className="text-xs text-destructive">{formErrors.entryPrice}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="stopLossPrice">
                              Stop Loss ($)
                              {isDataDerived && <span className="text-xs text-chart-1 ml-1">• Auto</span>}
                            </Label>
                            <Input
                              id="stopLossPrice"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={stopLossPrice}
                              onChange={(e) => {
                                setStopLossPrice(e.target.value);
                                setIsDataDerived(false);
                              }}
                              className={formErrors.stopLossPrice ? 'border-destructive' : ''}
                            />
                            {formErrors.stopLossPrice && (
                              <p className="text-xs text-destructive">{formErrors.stopLossPrice}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="takeProfitPrice">
                              Take Profit ($)
                              {isDataDerived && <span className="text-xs text-chart-1 ml-1">• Auto</span>}
                            </Label>
                            <Input
                              id="takeProfitPrice"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={takeProfitPrice}
                              onChange={(e) => {
                                setTakeProfitPrice(e.target.value);
                                setIsDataDerived(false);
                              }}
                              className={formErrors.takeProfitPrice ? 'border-destructive' : ''}
                            />
                            {formErrors.takeProfitPrice && (
                              <p className="text-xs text-destructive">
                                {formErrors.takeProfitPrice}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="riskAmount">Risk Amount ($)</Label>
                            <Input
                              id="riskAmount"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={riskAmount}
                              onChange={(e) => setRiskAmount(e.target.value)}
                              className={formErrors.riskAmount ? 'border-destructive' : ''}
                            />
                            {formErrors.riskAmount && (
                              <p className="text-xs text-destructive">{formErrors.riskAmount}</p>
                            )}
                          </div>
                        </div>

                        <Button
                          onClick={handleAnalyze}
                          disabled={isPending || !disclaimerAcknowledged}
                          className="w-full"
                          size="lg"
                        >
                          {isPending ? 'Analyzing...' : 'Analyze Trade Setup'}
                        </Button>

                        {error && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {error instanceof Error ? error.message : 'Analysis failed'}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    <CsvUploadPanel onIndicatorsComputed={setIndicators} />
                  </div>

                  {/* Results */}
                  <div className="space-y-6">
                    {result && (
                      <>
                        <Card className="border-chart-1/20 bg-card/50 backdrop-blur">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Target className="h-5 w-5 text-chart-1" />
                              Trade Setup Analysis
                            </CardTitle>
                            <CardDescription>
                              {ticker} • {direction} Position
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Position Size</p>
                                <p className="text-2xl font-bold">
                                  {result.positionSize.toFixed(2)} shares
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Risk:Reward</p>
                                <p className="text-2xl font-bold text-chart-1">
                                  1:{result.riskRewardRatio.toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 rounded-lg bg-chart-2/10 border border-chart-2/20">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-chart-2" />
                                  <span className="text-sm font-medium">Potential Profit</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-chart-2">
                                    {formatCurrency(potentialProfit || 0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPercentage(profitPercentage || 0)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-destructive" />
                                  <span className="text-sm font-medium">Potential Loss</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-destructive">
                                    {formatCurrency(potentialLoss || 0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPercentage(lossPercentage || 0)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Analysis Explanation</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {result.explanation}
                            </p>

                            {indicators && (
                              <>
                                <Separator className="my-3" />
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Technical Indicators</p>
                                  <div className="space-y-1 text-sm text-muted-foreground">
                                    {indicators.sma20 && (
                                      <p>• 20-period SMA: ${indicators.sma20.toFixed(2)}</p>
                                    )}
                                    {indicators.support && (
                                      <p>• Support Level: ${indicators.support.toFixed(2)}</p>
                                    )}
                                    {indicators.resistance && (
                                      <p>• Resistance Level: ${indicators.resistance.toFixed(2)}</p>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground italic mt-2">
                                    {isDataDerived
                                      ? 'These indicators are derived from live market data and were used to auto-populate your trade levels.'
                                      : 'These indicators provide additional context for the trade setup. Consider how price action relates to these levels when planning your trade.'}
                                  </p>
                                </div>
                              </>
                            )}

                            <Alert className="mt-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                This analysis is for educational purposes only and does not
                                constitute financial advice. Trading involves substantial risk of
                                loss. Always conduct your own research and consider consulting with a
                                licensed financial advisor.
                              </AlertDescription>
                            </Alert>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history">
                <HistoryPanel />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Welcome to Trade Setup Analyzer</h2>
                <p className="text-muted-foreground">
                  Analyze your trade setups with live market data and technical indicators
                </p>
              </div>
              <div className="flex justify-center">
                <LoginButton />
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 mt-12">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <p>© {new Date().getFullYear()} Trade Setup Analyzer. Educational purposes only.</p>
              <p>
                Built with ❤️ using{' '}
                <a
                  href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                    typeof window !== 'undefined' ? window.location.hostname : 'trade-analyzer'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  caffeine.ai
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>

      <ProfileSetupModal open={showProfileSetup} />
    </div>
  );
}
