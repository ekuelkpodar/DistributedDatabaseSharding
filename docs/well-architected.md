# Well-Architected Alignment (v2)

## Reliability
- Control plane is stateless Fastify API; backing store targets DynamoDB Global Tables. Routers cache shard-map with TTL + invalidation and fail open with stale data.
- Workers are queue-driven (SQS/KEDA-ready) with lease locks and idempotency keys. All long-running ops modeled as state machines (failover, failback, shard split).
- Two-lane replication: Lane A streaming (Kinesis/MSK) for low RPO; Lane B S3+CRR immutable WAL archive with versioned manifests and checksums.
- Traffic layer: Route 53 health checks + failover, optional Global Accelerator, regional NLB per router pool. Explicit degraded-mode semantics (read-only, consistency downgrade).

## Security
- Per-tenant isolation: required `tenant_id` on every call, scoped policies, optional dedicated router/shard groups for premium tiers.
- KMS: per-tenant CMKs for customer-managed encryption (premium). IAM least privilege for control plane, workers, routers.
- Audit: append-only events for shard moves, promotions, policy changes, access changes.

## Cost Optimization
- Tiered replication (Bronze S3-only, Silver streaming+S3, Gold adds sync intra-region replicas). Placement engine considers regional cost and scheduled peak windows.
- Autoscaling via KEDA (queue depth/lag) and predictive pre-warm for hot fleets. Cold data to S3 + Iceberg/Delta for cheap analytics.

## Operational Excellence
- State machines with explicit phases and retries. Error budgets tied to deployment velocity; progressive delivery (canary/blue-green) per region.
- Runbooks for failover/failback/hot-shard split. OTel traces + structured logs with tenant/shard/region/request ids.

## Performance Efficiency
- Region-aware routing with nearest healthy replica for bounded/eventual tiers. Hot shard detection triggers split or dedicated shard placement.
- Streaming lane for low-latency replication; cache TTL tuned per SLOs.

## Sustainability
- S3-based archive reduces always-on compute; scheduled scale-down in off-peak regions; cold storage for historical telemetry.
