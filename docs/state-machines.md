# State Machines (failover/failback/shard split)

## Failover
States: `idle` → `detecting` → `declared` → `promoting` → `updating-map` → `verifying` → `complete` (or `rollback`).
Guards:
- require health signal + lag window
- promotion only if standby lsn >= primary lsn - threshold
- rollback if verification fails

## Failback
States: `idle` → `catching-up` → `shadow-verify` → `switchover` → `complete`.
Guards:
- must be fully caught up from S3 archive
- shadow verification compares checksums/LSNs

## Shard Split (hot shard)
States: `idle` → `plan` → `prepare` → `dual-write|fork` → `migrate` → `verify` → `complete`.
Guards:
- require capacity in target regions
- traffic shaping during migrate

## Idempotency
- Each transition carries `operationId`, `attempt`, `leaseOwner`, `lastUpdated`. Workers must dedupe on `operationId`.
- Persisted in control-plane metadata store with versioned documents.
