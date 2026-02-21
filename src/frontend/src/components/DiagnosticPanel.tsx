import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, Activity, Database, RefreshCw, Clock, Globe } from 'lucide-react';
import { useState } from 'react';
import type { DiagnosticData } from '../lib/marketData/marketDataClient';

interface DiagnosticPanelProps {
  data: DiagnosticData;
}

function getEnvironmentInfo() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
  
  return {
    hostname,
    origin,
    environment: isDevelopment ? 'development' : 'production',
  };
}

export default function DiagnosticPanel({ data }: DiagnosticPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const env = getEnvironmentInfo();

  return (
    <div className="mt-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-warning/50 bg-background/95 backdrop-blur-sm">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-warning" />
                  <CardTitle className="text-base">Market Data Diagnostics</CardTitle>
                  <Badge variant="outline" className="text-xs">Debug Mode</Badge>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              <CardDescription className="text-left">
                Request details, cache state, retry history, and environment info
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[500px] pr-4">
                {/* Environment Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4" />
                    Environment
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 space-y-1 font-mono text-xs">
                    <div><span className="text-muted-foreground">Mode:</span> {env.environment}</div>
                    <div><span className="text-muted-foreground">Hostname:</span> {env.hostname}</div>
                    <div><span className="text-muted-foreground">Origin:</span> {env.origin}</div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Last Request */}
                {data.lastRequest && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Activity className="h-4 w-4" />
                      Last Request
                    </div>
                    <div className="bg-muted/50 rounded-md p-3 space-y-1 font-mono text-xs">
                      <div><span className="text-muted-foreground">Ticker:</span> {data.lastRequest.ticker}</div>
                      <div className="break-all"><span className="text-muted-foreground">URL:</span> {data.lastRequest.url}</div>
                      <div><span className="text-muted-foreground">Time:</span> {new Date(data.lastRequest.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                )}

                {/* Last Response */}
                {data.lastResponse && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <RefreshCw className="h-4 w-4" />
                        Last Response
                      </div>
                      <div className="bg-muted/50 rounded-md p-3 space-y-1 font-mono text-xs">
                        <div><span className="text-muted-foreground">Status:</span> {data.lastResponse.status}</div>
                        <div className="break-all"><span className="text-muted-foreground">Body:</span> {data.lastResponse.bodyPreview}</div>
                        <div><span className="text-muted-foreground">Time:</span> {new Date(data.lastResponse.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Cache Stats */}
                <Separator className="my-4" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Database className="h-4 w-4" />
                    Cache Statistics
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total Entries:</span>
                      <span className="font-mono">{data.cacheStats.entries}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cache Hits:</span>
                      <span className="font-mono text-success">{data.cacheStats.hits}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cache Misses:</span>
                      <span className="font-mono text-warning">{data.cacheStats.misses}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Hit Rate:</span>
                      <span className="font-mono">
                        {data.cacheStats.hits + data.cacheStats.misses > 0
                          ? Math.round((data.cacheStats.hits / (data.cacheStats.hits + data.cacheStats.misses)) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>

                  {data.cacheStats.cacheEntries.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <div className="text-xs text-muted-foreground">Cached Tickers:</div>
                      {data.cacheStats.cacheEntries.map((entry) => (
                        <div key={entry.ticker} className="bg-muted/30 rounded px-2 py-1 text-xs font-mono flex justify-between">
                          <span>{entry.ticker}</span>
                          <span className="text-muted-foreground">
                            Age: {entry.age}s | TTL: {entry.ttlRemaining}s
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Retry History */}
                {data.retryHistory.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        Retry History
                      </div>
                      <div className="space-y-1">
                        {data.retryHistory.map((retry, idx) => (
                          <div key={`${retry.ticker}-${idx}`} className="bg-muted/50 rounded-md p-2 text-xs font-mono space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Ticker:</span>
                              <span>{retry.ticker}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Attempts:</span>
                              <span>{retry.attemptCount}</span>
                            </div>
                            {retry.backoffDelay !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Next Retry:</span>
                                <span>{retry.backoffDelay}s</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
