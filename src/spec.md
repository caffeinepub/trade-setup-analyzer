# Specification

## Summary
**Goal:** Diagnose and fix market data fetch failures by adding comprehensive logging, error recovery, and a developer diagnostic mode.

**Planned changes:**
- Add detailed logging throughout the market data fetch pipeline to capture API requests, responses, errors, cache behavior, and retry attempts
- Validate Alpha Vantage API key presence and URL construction with clear error messages for missing or malformed keys
- Implement error recovery logic for network timeouts, unexpected response formats, and missing data with automatic retry and user-friendly messages
- Enhance error display in the UI to show specific guidance based on error type (rate limits with cooldown timer, invalid ticker suggestions, network connectivity prompts, API error messages)
- Add a developer diagnostic mode accessible via URL parameter (?debug=market-data) that displays request details, raw API responses, cache state, retry history, and backoff schedule in a collapsible panel

**User-visible outcome:** Users will see clear, specific error messages when market data fails to load, with actionable guidance based on the error type. Developers can enable diagnostic mode to troubleshoot fetch issues with detailed request/response information and cache state visibility.
