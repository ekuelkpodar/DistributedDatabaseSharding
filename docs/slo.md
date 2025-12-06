# SLOs & Error Budgets (v2)

## Service SLOs (examples)
- Write availability per shard: 99.95% monthly
- Read latency (p95) per region: < 120ms (strong), < 80ms (bounded/eventual)
- Replica lag bounds: strong ≤ 1s, bounded ≤ 5s, eventual ≤ 30s
- Failover completion: ≤ 120s for Gold, ≤ 300s for Silver

## Error Budget Policy
- Budgets measured per tier. If budget burn > 30% weekly → freeze non-critical deploys; > 50% → progressive rollback to last healthy release.
- Canary required for all router/control-plane releases. Region-by-region rollout; halt on budget burn or anomaly in replica lag.

## Degraded Modes
- Read-only for writes in impacted region; consistency downgrade (strong→bounded) allowed only with user-visible status flag.
- Cache TTL can extend to preserve availability when metadata is unreachable; logs must flag stale routing decisions.

## Testable SLO Hooks
- Synthetic probes per shard (write/read/verify) per region.
- Alerting on replica lag, streaming lane backlog, S3 manifest backlog, cache staleness, failover state stuck.

## RPO/RTO SKUs
- Bronze: RPO ≤ 5m (S3-only), RTO ≤ 15m
- Silver: RPO ≤ 30s (streaming+S3), RTO ≤ 5m
- Gold/Platinum: RPO ≤ 5s (streaming + sync intra-region + S3), RTO ≤ 2m
