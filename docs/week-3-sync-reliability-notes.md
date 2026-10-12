# Week 3 sync reliability notes

## Implemented in this PR

- Pending local cloud-sync changes are persisted in the sync status.
- The sync status exposes `pendingLocalChanges`, `pendingSince`, `lastAttemptAt`, and `retryCount`.
- A normal cloud pull is blocked when local pending changes exist, so the app does not silently overwrite unsynced local work.
- `resolvePendingCloudChanges()` centralizes the safe path for uploading pending local changes.
- Frontend tests cover pending-state detection, unsafe pull blocking, pending resolution, and skipped uploads when there is nothing pending.

## Deferred hardening

A backend optimistic-concurrency check based on the last known cloud `updatedAt` should be added with a PostgreSQL-backed integration test. That future change should verify timestamp precision, row-lock behavior, and the HTTP 409 `sync_conflict` response before enabling strict multi-device conflict enforcement.
