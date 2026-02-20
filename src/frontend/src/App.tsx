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
import DiagnosticPanel from './components/DiagnosticPanel';
import { validateNumericInput, validateRequired } from './lib/validation';
import { computePotentialProfit, computePotentialLoss, formatCurrency, formatPercentage } from './lib/tradeMath';
import { computeIndicatorsFromMarketData } from './lib/indicators';
import { deriveTradeInputs } from './lib/marketData/deriveTradeInputs';
import { hasUrlParam } from './lib/urlParams';
import { TrendingUp, AlertTriangle, DollarSign, Target, Shield, RefreshCw, Activity, Clock, Timer, Wifi, WifiOff } from 'lucide-react';
import type { IndicatorData } from './lib/indicators';

export default function App() {
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
  const { mutate: analyzeTrade, isPending, data: result, error } = useAnalyzeTrade();
  const marketData = useMarketData();

  const isAuthenticated = !!identity;
  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;
  const debugMode = hasUrlParam('debug', 'market-data');

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

  // Determine if fetch/refresh should be disabled
  const isFetchDisabled = marketData.isLoading || marketData.isCooldown;

  // Render error message based on error type
  const renderErrorMessage = () => {
    if (!marketData.error) return null;

    const { errorCode, error: errorMessage } = marketData.error;

    switch (errorCode) {
      case 'rate_limit':
        return (
          <Alert className="border-warning/50 bg-warning/10">
            <Timer className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              <div className="font-medium">Rate limit reached. Retrying in {marketData.cooldownSecondsRemaining}s...</div>
              <div className="text-xs mt-1 opacity-80">
                The app will automatically retry when the cooldown expires.
              </div>
            </AlertDescription>
          </Alert>
        );

      case 'invalid_ticker':
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">{errorMessage}</div>
              <div className="text-xs mt-1 opacity-80">
                Please verify the ticker symbol is correct (e.g., AAPL, MSFT, GOOGL).
              </div>
            </AlertDescription>
          </Alert>
        );

      case 'network_error':
        return (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">Network error: {errorMessage}</div>
              <div className="text-xs mt-1 opacity-80">
                Please check your internet connection and try again.
              </div>
            </AlertDescription>
          </Alert>
        );

      case 'timeout':
        return (
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">Request timed out</div>
              <div className="text-xs mt-1 opacity-80">
                The request took too long to complete. Please check your connection and try again.
              </div>
            </AlertDescription>
          </Alert>
        );

      case 'no_data':
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">No data available for this ticker</div>
              <div className="text-xs mt-1 opacity-80">
                The ticker may be delisted, or data is not available from the provider.
              </div>
            </AlertDescription>
          </Alert>
        );

      case 'config_error':
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">Configuration error: {errorMessage}</div>
              <div className="text-xs mt-1 opacity-80">
                Please check the API key configuration.
              </div>
            </AlertDescription>
          </Alert>
        );

      case 'api_error':
      default:
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">{errorMessage}</div>
              {marketData.error.rawResponse && (
                <div className="text-xs mt-1 opacity-80 font-mono">
                  {marketData.error.rawResponse}
                </div>
              )}
            </AlertDescription>
          </Alert>
        );
    }
  };

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
                                setFormErrors((prev) => ({ ...prev, ticker: '' }));
                              }}
                              className={formErrors.ticker ? 'border-destructive' : ''}
                            />
                            <Button
                              onClick={handleFetchLiveData}
                              disabled={isFetchDisabled}
                              variant="secondary"
                              className="shrink-0"
                            >
                              {marketData.isLoading ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Loading...
                                </>
                              ) : marketData.isCooldown ? (
                                <>
                                  <Timer className="h-4 w-4 mr-2" />
                                  {marketData.cooldownSecondsRemaining}s
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
                            <p className="text-sm text-destructive">{formErrors.ticker}</p>
                          )}
                        </div>

                        {/* Live Data Status Panel */}
                        {(marketData.isSuccess || marketData.isError || marketData.isCooldown) && (
                          <div className="space-y-2">
                            {marketData.isSuccess && marketData.data && (
                              <Alert className="border-success/50 bg-success/10">
                                <Wifi className="h-4 w-4 text-success" />
                                <AlertDescription className="text-success">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <strong>{marketData.data.ticker}</strong>: ${marketData.data.latestPrice.toFixed(2)}
                                      <span className="text-xs ml-2 opacity-70">
                                        ({marketData.data.isRealtime ? 'Real-time' : 'Last close'})
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleRefreshData}
                                      disabled={isFetchDisabled}
                                      className="h-7 text-xs"
                                    >
                                      {marketData.isCooldown ? (
                                        <>
                                          <Timer className="h-3 w-3 mr-1" />
                                          {marketData.cooldownSecondsRemaining}s
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Refresh
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  {marketData.lastRefreshTime && (
                                    <div className="text-xs opacity-70 mt-1 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Last updated: {marketData.lastRefreshTime.toLocaleTimeString()}
                                    </div>
                                  )}
                                </AlertDescription>
                              </Alert>
                            )}

                            {(marketData.isError || marketData.isCooldown) && renderErrorMessage()}
                          </div>
                        )}

                        <Separator />

                        <div className="space-y-2">
                          <Label htmlFor="entryPrice">Entry Price ($)</Label>
                          <Input
                            id="entryPrice"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={entryPrice}
                            onChange={(e) => {
                              setEntryPrice(e.target.value);
                              setIsDataDerived(false);
                              setFormErrors((prev) => ({ ...prev, entryPrice: '' }));
                            }}
                            className={formErrors.entryPrice ? 'border-destructive' : ''}
                          />
                          {formErrors.entryPrice && (
                            <p className="text-sm text-destructive">{formErrors.entryPrice}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stopLossPrice">Stop Loss Price ($)</Label>
                          <Input
                            id="stopLossPrice"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={stopLossPrice}
                            onChange={(e) => {
                              setStopLossPrice(e.target.value);
                              setIsDataDerived(false);
                              setFormErrors((prev) => ({ ...prev, stopLossPrice: '' }));
                            }}
                            className={formErrors.stopLossPrice ? 'border-destructive' : ''}
                          />
                          {formErrors.stopLossPrice && (
                            <p className="text-sm text-destructive">{formErrors.stopLossPrice}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="takeProfitPrice">Take Profit Price ($)</Label>
                          <Input
                            id="takeProfitPrice"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={takeProfitPrice}
                            onChange={(e) => {
                              setTakeProfitPrice(e.target.value);
                              setIsDataDerived(false);
                              setFormErrors((prev) => ({ ...prev, takeProfitPrice: '' }));
                            }}
                            className={formErrors.takeProfitPrice ? 'border-destructive' : ''}
                          />
                          {formErrors.takeProfitPrice && (
                            <p className="text-sm text-destructive">{formErrors.takeProfitPrice}</p>
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
                            onChange={(e) => {
                              setRiskAmount(e.target.value);
                              setFormErrors((prev) => ({ ...prev, riskAmount: '' }));
                            }}
                            className={formErrors.riskAmount ? 'border-destructive' : ''}
                          />
                          {formErrors.riskAmount && (
                            <p className="text-sm text-destructive">{formErrors.riskAmount}</p>
                          )}
                        </div>

                        <Button
                          onClick={handleAnalyze}
                          disabled={isPending || !disclaimerAcknowledged}
                          className="w-full"
                          size="lg"
                        >
                          {isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Analyze Trade Setup
                            </>
                          )}
                        </Button>

                        {error && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {error instanceof Error ? error.message : 'Failed to analyze trade'}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {/* CSV Upload Panel */}
                    <CsvUploadPanel
                      onDataLoaded={(data, computedIndicators) => {
                        setTicker(data.ticker || '');
                        setIndicators(computedIndicators);
                        const derived = deriveTradeInputs(
                          {
                            ticker: data.ticker || '',
                            latestPrice: data.pricePoints[data.pricePoints.length - 1].close,
                            timestamp: data.pricePoints[data.pricePoints.length - 1].timestamp,
                            isRealtime: false,
                            pricePoints: data.pricePoints,
                            provider: 'CSV Upload',
                          },
                          computedIndicators
                        );
                        setEntryPrice(derived.entryPrice.toFixed(2));
                        setStopLossPrice(derived.stopLoss.toFixed(2));
                        setTakeProfitPrice(derived.takeProfit.toFixed(2));
                        setIsDataDerived(true);
                      }}
                    />
                  </div>

                  {/* Results Panel */}
                  <div className="space-y-6">
                    {result && (
                      <>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Target className="h-5 w-5" />
                              Position Sizing
                            </CardTitle>
                            <CardDescription>Calculated based on your risk parameters</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                              <div>
                                <p className="text-sm text-muted-foreground">Position Size</p>
                                <p className="text-2xl font-bold">{result.positionSize.toFixed(2)} shares</p>
                              </div>
                              {direction && (
                                <Badge variant={direction === 'LONG' ? 'default' : 'secondary'} className="text-sm">
                                  {direction}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Risk/Reward Ratio</p>
                                <p className="text-xl font-bold text-success">
                                  1:{result.riskRewardRatio.toFixed(2)}
                                </p>
                              </div>

                              <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Risk Amount</p>
                                <p className="text-xl font-bold">{formatCurrency(parseFloat(riskAmount))}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5" />
                              Profit & Loss Projections
                            </CardTitle>
                            <CardDescription>Potential outcomes at target levels</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-success">Potential Profit (Take Profit)</p>
                                <Badge variant="outline" className="text-success border-success/30">
                                  {profitPercentage ? `+${formatPercentage(profitPercentage)}` : 'N/A'}
                                </Badge>
                              </div>
                              <p className="text-2xl font-bold text-success">
                                {potentialProfit ? formatCurrency(potentialProfit) : 'N/A'}
                              </p>
                            </div>

                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-destructive">Potential Loss (Stop Loss)</p>
                                <Badge variant="outline" className="text-destructive border-destructive/30">
                                  {lossPercentage ? formatPercentage(lossPercentage) : 'N/A'}
                                </Badge>
                              </div>
                              <p className="text-2xl font-bold text-destructive">
                                {potentialLoss ? formatCurrency(potentialLoss) : 'N/A'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              Explanation
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">{result.explanation}</p>
                          </CardContent>
                        </Card>

                        {indicators && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Technical Indicators
                              </CardTitle>
                              <CardDescription>
                                {isDataDerived && 'Used to auto-populate trade levels'}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {indicators.sma20 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">20-period SMA:</span>
                                  <span className="font-mono">${indicators.sma20.toFixed(2)}</span>
                                </div>
                              )}
                              {indicators.support && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Support Level:</span>
                                  <span className="font-mono text-success">${indicators.support.toFixed(2)}</span>
                                </div>
                              )}
                              {indicators.resistance && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Resistance Level:</span>
                                  <span className="font-mono text-destructive">${indicators.resistance.toFixed(2)}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Diagnostic Panel */}
                {debugMode && marketData.diagnostics && (
                  <DiagnosticPanel data={marketData.diagnostics} />
                )}
              </TabsContent>

              <TabsContent value="history">
                <HistoryPanel />
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>Welcome to Trade Setup Analyzer</CardTitle>
                <CardDescription>
                  An educational tool for analyzing trade setups with risk management calculations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please log in with Internet Identity to access the trade analyzer and save your analysis history.
                </p>
                <div className="flex justify-center pt-4">
                  <LoginButton />
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 mt-16">
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
                  className="text-primary hover:underline"
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
