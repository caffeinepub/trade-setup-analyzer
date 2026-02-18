import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { parsePriceCsv } from '../lib/csv/parsePriceCsv';
import { computeIndicators, type IndicatorData, type PriceData } from '../lib/indicators';
import { Upload, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

interface CsvUploadPanelProps {
  onIndicatorsComputed: (indicators: IndicatorData | null) => void;
}

export default function CsvUploadPanel({ onIndicatorsComputed }: CsvUploadPanelProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parsePriceCsv(text);

      if (result.errors.length > 0) {
        setStatus('error');
        setMessage(result.errors[0]);
        setIndicators(null);
        onIndicatorsComputed(null);
      } else if (result.data.length === 0) {
        setStatus('error');
        setMessage('No valid data found in CSV');
        setIndicators(null);
        onIndicatorsComputed(null);
      } else {
        // Convert CSV PriceData (with Date) to indicators PriceData (with string date)
        const priceData: PriceData[] = result.data.map(item => ({
          date: item.date.toISOString(),
          open: item.open ?? item.close,
          high: item.high ?? item.close,
          low: item.low ?? item.close,
          close: item.close,
          volume: item.volume ?? 0,
        }));
        
        const computed = computeIndicators(priceData);
        setStatus('success');
        setMessage(`Successfully parsed ${result.data.length} price records`);
        setIndicators(computed);
        onIndicatorsComputed(computed);
      }
    };

    reader.onerror = () => {
      setStatus('error');
      setMessage('Failed to read file');
      setIndicators(null);
      onIndicatorsComputed(null);
    };

    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          Historical Data (Optional)
        </CardTitle>
        <CardDescription>
          Upload a CSV file with historical prices to compute technical indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-upload">CSV File</Label>
          <Input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Expected format: date, close (and optionally: open, high, low, volume)
          </p>
        </div>

        {status === 'success' && (
          <Alert className="border-chart-2/50 bg-chart-2/10">
            <CheckCircle2 className="h-4 w-4 text-chart-2" />
            <AlertDescription className="text-sm">{message}</AlertDescription>
          </Alert>
        )}

        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{message}</AlertDescription>
          </Alert>
        )}

        {indicators && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-chart-1" />
              <p className="text-sm font-medium">Computed Indicators</p>
            </div>
            <div className="space-y-1 text-sm">
              {indicators.sma20 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">20-period SMA:</span>
                  <span className="font-mono">${indicators.sma20.toFixed(2)}</span>
                </div>
              )}
              {indicators.support && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Support Level:</span>
                  <span className="font-mono">${indicators.support.toFixed(2)}</span>
                </div>
              )}
              {indicators.resistance && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resistance Level:</span>
                  <span className="font-mono">${indicators.resistance.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
