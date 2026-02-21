# Specification

## Summary
**Goal:** Fix the Yahoo Finance market data fetching failure by adding comprehensive error logging, verifying API endpoint construction, and improving error handling.

**Planned changes:**
- Add detailed error logging to capture HTTP status, response headers, response body, and network exceptions in fetchMarketData.ts
- Verify and fix the Yahoo Finance API endpoint URL format and query parameters
- Add specific error handling for CORS, network timeouts, DNS failures, and SSL/TLS errors
- Update useMarketData hook to display raw error messages with technical details in the UI
- Test the integration with valid ticker symbols in both development and production environments

**User-visible outcome:** When market data fails to load, users will see specific error messages explaining the exact failure reason (CORS block, network timeout, invalid ticker, etc.) instead of generic "fail to fetch data" errors, making it easier to diagnose and resolve issues.
