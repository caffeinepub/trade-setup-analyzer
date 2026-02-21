import { useState, useEffect } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useUserProfile';
import { useAnalyzeTrade } from './hooks/useTradeAnalysis';
import LoginButton from './components/auth/LoginButton';
import ProfileSetupModal from './components/auth/ProfileSetupModal';
import DisclaimerGate from './components/DisclaimerGate';
import CsvUploadPanel from './components/CsvUploadPanel';
import HistoryPanel from './components/history/HistoryPanel';
import DiagnosticPanel from './components/DiagnosticPanel';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Separator } from './components/ui/separator';
import { validateRequired, validateNumericInput } from './lib/validation';
import { formatCurrency, formatPercentage, computePotentialProfit, computePotentialLoss } from './lib/tradeMath';
import { useMarketData } from './hooks/useMarketData';
import { deriveTradeInputs } from './lib/marketData/deriveTradeInputs';
import { computeIndicators } from './lib/indicators';
import { hasUrlParam } from './lib/urlParams';
import { TrendingUp, AlertCircle, RefreshCw, Heart, AlertTriangle, Info } from 'lucide-react';
import type { PricePoint } from './lib/marketData/types';
import type { IndicatorData } from './lib/indicators';

function App() {
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
  const analyzeTradeMutation = useAnalyzeTrade();
  const marketData = useMarketData();

  const isAuthenticated = !!identity;
  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

  // Form state
  const [ticker, setTicker] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [riskAmount, setRiskAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);

  // Debug mode
  const showDiagnostics = hasUrlParam('debug', 'market-data');

  // Auto-populate from market data
  useEffect(() => {
    if (marketData.isSuccess && marketData.data) {
      const priceData = marketData.data.pricePoints.map(point => ({
        date: point.timestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
      }));
      
      const indicators = computeIndicators(priceData);
      const derived = deriveTradeInputs(marketData.data, indicators);
      
      setEntryPrice(derived.entryPrice.toFixed(2));
      setStopLossPrice(derived.stopLoss.toFixed(2));
      setTakeProfitPrice(derived.takeProfit.toFixed(2));
    }
  }, [marketData.isSuccess, marketData.data]);

  const handleFetchMarketData = () => {
    if (!ticker.trim()) {
      setErrors({ ticker: 'Please enter a ticker symbol' });
      return;
    }
    setErrors({});
    marketData.fetchData(ticker);
  };

  const handleCsvDataLoaded = (data: { ticker: string; pricePoints: PricePoint[] }, indicators: IndicatorData) => {
    // Convert PricePoint[] to the format expected by deriveTradeInputs
    const mockMarketData = {
      ticker: data.ticker,
      latestPrice: data.pricePoints[data.pricePoints.length - 1].close,
      timestamp: data.pricePoints[data.pricePoints.length - 1].timestamp,
      isRealtime: false,
      pricePoints: data.pricePoints,
      provider: 'CSV Upload',
    };
    
    const derived = deriveTradeInputs(mockMarketData, indicators);
    setTicker(data.ticker);
    setEntryPrice(derived.entryPrice.toFixed(2));
    setStopLossPrice(derived.stopLoss.toFixed(2));
    setTakeProfitPrice(derived.takeProfit.toFixed(2));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!validateRequired(ticker)) {
      newErrors.ticker = 'Ticker is required';
    }

    const entryError = validateNumericInput(entryPrice, 'Entry Price', true);
    if (entryError) newErrors.entryPrice = entryError;

    const stopError = validateNumericInput(stopLossPrice, 'Stop Loss Price', true);
    if (stopError) newErrors.stopLossPrice = stopError;

    const takeProfitError = validateNumericInput(takeProfitPrice, 'Take Profit Price', true);
    if (takeProfitError) newErrors.takeProfitPrice = takeProfitError;

    const riskError = validateNumericInput(riskAmount, 'Risk Amount', true);
    if (riskError) newErrors.riskAmount = riskError;

    // Additional validation: stop loss should be less than entry
    if (!entryError && !stopError) {
      const entry = parseFloat(entryPrice);
      const stop = parseFloat(stopLossPrice);
      if (stop >= entry) {
        newErrors.stopLossPrice = 'Stop loss must be less than entry price';
      }
    }

    // Additional validation: take profit should be greater than entry
    if (!entryError && !takeProfitError) {
      const entry = parseFloat(entryPrice);
      const takeProfit = parseFloat(takeProfitPrice);
      if (takeProfit <= entry) {
        newErrors.takeProfitPrice = 'Take profit must be greater than entry price';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnalyze = async () => {
    if (!validateForm()) return;

    if (!disclaimerAcknowledged) {
      return;
    }

    await analyzeTradeMutation.mutateAsync({
      ticker,
      entryPrice: parseFloat(entryPrice),
      stopLossPrice: parseFloat(stopLossPrice),
      takeProfitPrice: parseFloat(takeProfitPrice),
      riskAmount: parseFloat(riskAmount),
    });
  };

  const result = analyzeTradeMutation.data;
  const entry = parseFloat(entryPrice) || 0;
  const stop = parseFloat(stopLossPrice) || 0;
  const takeProfit = parseFloat(takeProfitPrice) || 0;
  const risk = parseFloat(riskAmount) || 0;

  const potentialProfit = result ? computePotentialProfit(entry, takeProfit, result.positionSize) : 0;
  const potentialLoss = result ? computePotentialLoss(entry, stop, result.positionSize) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/generated/trade-setup-logo.dim_512x512.png" alt="Trade Setup Calculator" className="h-10 w-10" />
            <h1 className="text-2xl font-bold text-foreground">Trade Setup Calculator</h1>
          </div>
          <LoginButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isAuthenticated ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Welcome to Trade Setup Calculator</CardTitle>
              <CardDescription>
                Calculate position sizes and risk/reward ratios for your trades. Please log in to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <LoginButton />
            </CardContent>
          </Card>
        ) : (
          <>
            <Tabs defaultValue="calculator" className="space-y-6">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="calculator">Calculator</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="calculator" className="space-y-6">
                {/* Live Market Data Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Live Market Data
                    </CardTitle>
                    <CardDescription>
                      Fetch real-time price data and auto-populate trade inputs
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="ticker-input">Stock Ticker</Label>
                        <Input
                          id="ticker-input"
                          placeholder="e.g., AAPL, MSFT, TSLA"
                          value={ticker}
                          onChange={(e) => setTicker(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && handleFetchMarketData()}
                          disabled={marketData.isLoading || marketData.isCooldown}
                        />
                        {errors.ticker && (
                          <p className="text-sm text-destructive mt-1">{errors.ticker}</p>
                        )}
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={handleFetchMarketData}
                          disabled={marketData.isLoading || marketData.isCooldown}
                        >
                          {marketData.isLoading ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : marketData.isCooldown ? (
                            `Retry in ${marketData.cooldownSecondsRemaining}s`
                          ) : (
                            'Fetch Data'
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Status Messages */}
                    {marketData.isSuccess && marketData.data && (
                      <Alert>
                        <TrendingUp className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{marketData.data.ticker}</strong>: ${marketData.data.latestPrice.toFixed(2)} 
                          {' '}({marketData.data.isRealtime ? 'Real-time' : 'Last close'})
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Data source: {marketData.data.provider}
                            {marketData.lastRefreshTime && ` • Last refresh: ${marketData.lastRefreshTime.toLocaleTimeString()}`}
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}

                    {marketData.isError && marketData.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="font-semibold">
                          {marketData.error.errorCode === 'network_error' && 'Network Error'}
                          {marketData.error.errorCode === 'cors_error' && 'CORS Policy Block'}
                          {marketData.error.errorCode === 'timeout' && 'Request Timeout'}
                          {marketData.error.errorCode === 'invalid_ticker' && 'Invalid Ticker'}
                          {marketData.error.errorCode === 'api_error' && 'API Error'}
                          {marketData.error.errorCode === 'no_data' && 'No Data Available'}
                          {!['network_error', 'cors_error', 'timeout', 'invalid_ticker', 'api_error', 'no_data'].includes(marketData.error.errorCode) && 'Error'}
                        </AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{marketData.error.error}</p>
                          
                          {marketData.error.errorCode === 'network_error' && (
                            <div className="text-xs space-y-1 mt-2 p-2 bg-destructive/10 rounded">
                              <p className="font-medium">Troubleshooting:</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>Check your internet connection</li>
                                <li>Yahoo Finance may be blocking direct browser requests (CORS)</li>
                                <li>Try using the CSV upload feature instead</li>
                                <li>Open browser console (F12) for detailed error logs</li>
                              </ul>
                            </div>
                          )}
                          
                          {marketData.error.errorCode === 'invalid_ticker' && (
                            <p className="text-xs mt-1">
                              Make sure you're using a valid stock ticker symbol (e.g., AAPL for Apple Inc.)
                            </p>
                          )}
                          
                          {showDiagnostics && marketData.error.rawResponse && (
                            <details className="text-xs mt-2">
                              <summary className="cursor-pointer font-medium">Technical Details</summary>
                              <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">
                                {marketData.error.rawResponse}
                              </pre>
                            </details>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {marketData.isCooldown && marketData.error && (
                      <Alert>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <AlertDescription>
                          {marketData.error.error}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Automatic retry in {marketData.cooldownSecondsRemaining} seconds...
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Debug info banner */}
                    {showDiagnostics && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Debug Mode Active:</strong> Check browser console (F12) for detailed logs. 
                          Diagnostic panel available below.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Diagnostic Panel */}
                    {showDiagnostics && marketData.diagnostics && (
                      <DiagnosticPanel data={marketData.diagnostics} />
                    )}
                  </CardContent>
                </Card>

                {/* CSV Upload Alternative */}
                <CsvUploadPanel onDataLoaded={handleCsvDataLoaded} />

                <Separator />

                {/* Trade Input Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Trade Setup</CardTitle>
                    <CardDescription>
                      Enter your trade parameters or use auto-populated values from market data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="entry">Entry Price ($)</Label>
                        <Input
                          id="entry"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={entryPrice}
                          onChange={(e) => setEntryPrice(e.target.value)}
                        />
                        {errors.entryPrice && (
                          <p className="text-sm text-destructive mt-1">{errors.entryPrice}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="stop">Stop Loss Price ($)</Label>
                        <Input
                          id="stop"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={stopLossPrice}
                          onChange={(e) => setStopLossPrice(e.target.value)}
                        />
                        {errors.stopLossPrice && (
                          <p className="text-sm text-destructive mt-1">{errors.stopLossPrice}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="takeProfit">Take Profit Price ($)</Label>
                        <Input
                          id="takeProfit"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={takeProfitPrice}
                          onChange={(e) => setTakeProfitPrice(e.target.value)}
                        />
                        {errors.takeProfitPrice && (
                          <p className="text-sm text-destructive mt-1">{errors.takeProfitPrice}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="risk">Risk Amount ($)</Label>
                        <Input
                          id="risk"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={riskAmount}
                          onChange={(e) => setRiskAmount(e.target.value)}
                        />
                        {errors.riskAmount && (
                          <p className="text-sm text-destructive mt-1">{errors.riskAmount}</p>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzeTradeMutation.isPending || !disclaimerAcknowledged}
                      className="w-full"
                      size="lg"
                    >
                      {analyzeTradeMutation.isPending ? 'Analyzing...' : 'Analyze Trade'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Results */}
                {result && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Analysis Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Position Size</p>
                          <p className="text-2xl font-bold">{result.positionSize.toFixed(2)} shares</p>
                        </div>

                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Risk/Reward Ratio</p>
                          <p className="text-2xl font-bold">{formatPercentage(result.riskRewardRatio)}</p>
                        </div>

                        <div className="p-4 bg-destructive/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Potential Loss</p>
                          <p className="text-2xl font-bold text-destructive">{formatCurrency(potentialLoss)}</p>
                        </div>

                        <div className="p-4 bg-success/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Potential Profit</p>
                          <p className="text-2xl font-bold text-success">{formatCurrency(potentialProfit)}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-2">Explanation</p>
                        <p className="text-sm text-muted-foreground">{result.explanation}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history">
                <HistoryPanel />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <footer className="border-t border-border mt-16 py-8 bg-card/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            © {new Date().getFullYear()} Trade Setup Calculator • Built with{' '}
            <Heart className="h-4 w-4 text-red-500 fill-red-500" /> using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== 'undefined' ? window.location.hostname : 'trade-setup-calculator')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline font-medium"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>

      <ProfileSetupModal open={showProfileSetup} />
      <DisclaimerGate
        acknowledged={disclaimerAcknowledged}
        onAcknowledge={() => setDisclaimerAcknowledged(true)}
      />
    </div>
  );
}

export default App;
