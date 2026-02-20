# Specification

## Summary
**Goal:** Fix the infinite rate-limit retry loop that displays repeating "retrying in 1s..." messages and ensure proper exponential backoff behavior.

**Planned changes:**
- Fix retry state management to correctly track and increment attempt counts across retries
- Update retry logic to use actual backoff delays (10s, 30s, 60s) instead of fixed 1s intervals
- Stop retry loop after 3 failed attempts instead of continuing indefinitely
- Add 2-minute total timeout to gracefully exit if retries exceed maximum duration
- Ensure UI displays accurate cooldown timers that reflect the actual backoff delays

**User-visible outcome:** Rate-limit retry messages will show increasing delays (10s, 30s, 60s), stop after 3 attempts with a clear error message, and never loop indefinitely when hitting API rate limits.
