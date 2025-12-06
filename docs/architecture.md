# FleetShard Architecture Overview

## Planes
- **Control plane**: Fastify API for tenants, fleets, shard maps, failover/failback orchestrations. Metadata store targets DynamoDB Global Tables. SQS mediates worker tasks and leases.
- **Data plane**: Regional shard routers with shard-map caches and read/write routing rules. Postgres/MySQL shard nodes on EC2/EKS with primaries + replicas + warm standby.
- **Workers**: Replication (WAL/binlog → S3), recovery (apply manifests to standby), health monitoring, and rebalance jobs. All idempotent and queue-driven.

## Sharding & Routing
- Partition by `fleet_id` + time buckets. Consistent hashing ring with virtual nodes; shard map stored in DynamoDB (`fleetId → shardId`, `shardId → nodeGroup`).
- Routers are stateless, refresh shard-map cache on a short TTL, and choose targets based on op type + consistency mode + region hint.

## Replication & DR
- Two-lane replication:
  - Lane A: streaming via Kinesis/MSK for low RPO tiers.
  - Lane B: S3 + CRR immutable WAL archive with versioned manifests and checksums (authoritative replay).
- Primaries emit WAL/binlog segments to local staging; Replication Worker ships to S3 and/or stream.
- Recovery Worker tails manifests and replays to warm standby until LSN alignment. Optional Object Lock.

## Failover/Failback
- Health monitor ingests node/router signals. State machine phases: detect → declare → promote → update-map → verify.
- Failback treats the former primary as a secondary until it catches up from S3; then a controlled switchover updates the shard map.

## Security
- IAM least privilege per component; KMS per region; BYOK option for tenants with dedicated CMKs.
- Audit log every shard move, promotion, policy change.

## Observability
- Metrics per shard: latency p50/p95/p99, QPS, replica lag, WAL shipping lag, S3 manifest backlog.
- Structured events for shard moves, promotions, policy changes; traces across control-plane API + workers + routers.

## Analytics Plane
- Analytics pipeline sinks cold/warm data to S3 (Iceberg/Delta style) to offload OLTP shards.
