# Runbooks

## Regional Failover (A → B)
1. Detect: health monitor flags degraded primaries/routers or region outage signal.
2. Declare: freeze shard writes in Region A, mark shard state `degraded`.
3. Promote: choose warm standby in Region B, verify WAL replay to latest manifest.
4. Update map: write new shard map entry in DynamoDB with `primaryRegion=B`.
5. Invalidate caches: publish cache-bust to routers; expect refresh within seconds.
6. Verify: run LSN alignment check + synthetic reads/writes; lift write freeze.

## Failback (B → A)
1. Region A returns; mark as `catching-up`.
2. Recovery worker replays missing WAL from S3 until LSN matches Region B.
3. Shadow verification: mirror reads between regions and compare checksums.
4. Switchover: update shard map to promote Region A; routers refresh cache.
5. Demote Region B to standby; keep S3 shipping in both directions.

## Hot Shard Split
1. Detect elevated latency/QPS for shard.
2. Snapshot policy + placement inputs; propose split plan (new shard ids).
3. Create new shard nodes; begin dual-write (optional) or WAL fork.
4. Migrate fleet assignments; update shard map atomically.
5. Verify metrics; retire old shard when safe.
