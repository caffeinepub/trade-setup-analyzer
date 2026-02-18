# Specification

## Summary
**Goal:** Fetch live market data for a user-entered ticker, derive swing/support-resistance levels from that data, auto-populate trade inputs, and run analysis using those derived (or user-edited) values.

**Planned changes:**
- Add a frontend live market-data fetch flow for a ticker symbol with loading, success (latest/last-close + timestamp), and error states, using a single configurable base URL for the provider endpoint.
- Compute derived inputs (e.g., recent swing low/high or support/resistance from the fetched OHLC/close series) and auto-fill Entry Price, Stop Loss, and Take Profit while keeping values editable and labeled as derived from live data.
- Update the Analyzer flow so “Analyze Trade Setup” uses the current field values (derived by default, user-overridden if edited) and guides the user to fetch data first when live data has not been retrieved.
- Add a small live-data status panel in the Analyzer tab showing data source, last refresh time, current status (not fetched/loading/success/error), and a “Refresh Data” control that re-fetches and updates derived values while preserving the risk amount.
- Ensure the existing analysis results UI and per-user history behavior continue working unchanged, with any necessary backend adjustments limited to the existing actor.

**User-visible outcome:** Users can enter a ticker, fetch live/latest (or last-close) market data with clear status/timestamps, see entry/stop/take-profit auto-filled from the fetched series (editable), refresh the data on demand, and run the existing trade analysis using those populated values while history continues to work.
