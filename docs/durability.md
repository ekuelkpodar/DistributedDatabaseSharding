# Durability Tiers & Commit Policies

## Customer-facing tiers
- **Standard**: Regional sync quorum (3 AZs) + async cross-region. Low latency, small RPO on region loss.
- **Enhanced**: Regional sync quorum + streaming cross-region (Lane A) + S3 immutable WAL archive with CRR (Lane B). Very low RPO (seconds).
- **Platinum**: Regional sync quorum + optional global quorum (standby region ACK) for near-zero/zero RPO. Higher write latency, explicit SLA language.

## Commit rules
- **Regional quorum**: Primary + ≥1 synchronous replica in distinct AZ must durably ack before success (recommended default; can require ≥2 for stricter mode).
- **Global quorum (Platinum)**: Regional quorum **and** at least one standby-region replica ack before success; increases write latency.

## Replication lanes
- **Lane A (Streaming)**: Kinesis/MSK for low-latency change shipping to standby region nodes.
- **Lane B (Archive)**: WAL segments + manifests to S3 with CRR; optional Object Lock; versioned checkpoints.

## Shard map metadata (DynamoDB Global Tables)
- `primary_region`
- `replica_regions[]`
- `az_placement[]` (e.g., 3 AZ IDs)
- `durability_tier` (standard/enhanced/platinum)
- `commit_policy` (regional-quorum/global-quorum)
- `replication_lane` (s3-only/streaming+s3)
- `last_verified_checkpoint`

## Failover / Failback (state-machine phases)
- **Failover**: detect → freeze/degrade → promote → repoint shard map → verify → resume
- **Failback**: rehydrate → catch-up (streaming) → validate (S3 manifests) → controlled switchover → resume

## Product guarantees (plain language)
- **AZ loss**: zero data loss for Enhanced/Platinum (regional quorum).
- **Region loss**:
  - Enhanced: very low RPO via streaming + archive.
  - Platinum: near-zero/zero RPO when global quorum enabled; higher latency expected.

## Guardrails
- Backpressure: throttle writes if cross-region lag exceeds policy thresholds (Platinum) or downgrade tier with alerts (Enhanced).
- Integrity: checksums + signatures on WAL/manifests; versioned checkpoints.
- Chaos/DR tests: AZ loss, router loss, region isolation; validate RPO/RTO vs policy.
