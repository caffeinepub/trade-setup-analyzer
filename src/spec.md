# Specification

## Summary
**Goal:** Reduce live market-data API rate-limit errors by adding client-side caching, de-duplication, request spacing, and automatic retry with backoff plus clearer UI messaging.

**Planned changes:**
- Add a client-side cache for live market-data responses keyed by normalized ticker (trim + uppercase), storing the last successful payload and fetch timestamp, with a configurable TTL constant (default ~60s).
- Implement request de-duplication so repeated fetch attempts for the same ticker while a request is in-flight do not start additional network calls.
- Enforce a minimum interval between actual network calls per ticker (separate from caching) to prevent burst requests from rapid UI interactions.
- Detect provider rate-limit responses and automatically retry with exponential backoff (max retries + max delay), while showing a cooldown message with the next retry countdown and disabling fetch/refresh controls during cooldown.
- Improve market-data error typing to distinguish rate-limit errors from other errors, preserving existing invalid-ticker handling and current UI for non-rate-limit errors.

**User-visible outcome:** Fetching/refreshing live data for a ticker is less likely to hit API limits; repeated clicks reuse cached results, duplicate/burst calls are prevented, and if rate-limited the app shows a clear cooldown with automatic retries and actionable English error messages if retries fail.
