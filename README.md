# FleetShard – Global Fleet Database Sharding (AWS-Oriented)

This repo scaffolds a multi-tenant SaaS for global fleet data with 500–1000 database servers across AWS regions. It includes:

- Control plane API for tenants, fleets, shard maps, failover/failback orchestration
- Regional routers with shard-map cache and read/write policy decisions
- Background workers for replication, recovery, health, and rebalance workflows
- Next.js admin console for onboarding, shard visualization, and incidents
- Terraform skeleton for multi-region VPC, EKS/EC2 nodes, S3 CRR, DynamoDB Global Tables

## Quick Start (monorepo)

```bash
npm install
npm run dev:api      # control-plane-api (Fastify)
npm run dev:router   # router service
npm run dev:workers  # worker simulator
npm run dev:web      # Next.js admin console
```

## Repo Layout
- `control-plane-api/` – Fastify control-plane API with placement + failover planning stubs
- `router/` – stateless shard router with cache + regional read/write decisions
- `workers/` – replication/recovery/health/rebalance worker simulator
- `web-console/` – Next.js admin console (mock data)
- `analytics-pipeline/` – Iceberg/Delta-style cold/warm analytics sink (mock)
- `infra/` – Terraform skeleton for multi-region AWS deployment
- `docs/` – architecture notes, data models, runbooks

### Durability tiers (product language)
- Standard: regional sync quorum across 3 AZs, async cross-region.
- Enhanced: regional sync quorum + streaming cross-region + S3 archive (CRR).
- Platinum: optional global quorum commit (regional + standby ACK) for near-zero/zero RPO; higher write latency.

## Architecture (Mermaid)

```mermaid
flowchart TB
  subgraph Users
    APP[Client Apps / Fleet Systems]
  end

  subgraph GlobalEdge[Global Entry]
    GA[Global Accelerator / Route 53]
  end

  subgraph RegionA[AWS Region A]
    RTA[Shard Router Cluster]
    subgraph AZA1[AZ-a]
      A1P[(Shard A-1 Primary)]
    end
    subgraph AZA2[AZ-b]
      A1R1[(Shard A-1 Sync Replica)]
    end
    subgraph AZA3[AZ-c]
      A1R2[(Shard A-1 Sync Replica 2)]
    end
    CdcA[Streaming/WAL Agent]
    WkrA[Replication Workers]
    S3A[(S3 Bucket A)]
  end

  subgraph RegionB[AWS Region B]
    RTB[Shard Router Cluster]
    subgraph BZ1[AZ-a]
      B1W[(Warm Standby)]
    end
    subgraph BZ2[AZ-b]
      B1R1[(Replica)]
    end
    subgraph BZ3[AZ-c]
      B1R2[(Replica)]
    end
    WkrB[Recovery Workers]
    S3B[(S3 Bucket B)]
  end

  subgraph ControlPlane[Global Control Plane]
    SM[Shard Manager API]
    PE[Placement & Rebalance Engine]
    HM[Health Monitor]
    META[(DynamoDB Global Tables\nShard Map + Node Inventory)]
    OBS[Metrics/Logs/Tracing]
  end

  APP --> GA
  GA --> RTA
  GA --> RTB

  RTA --> A1P
  RTA --> A1R1
  RTA --> A1R2

  CdcA --> WkrA --> S3A
  S3A -- CRR --> S3B
  S3B --> WkrB --> B1W
  S3B --> WkrB --> B1R1
  S3B --> WkrB --> B1R2

  SM --> META
  PE --> META
  HM --> META
  RTA -. cache refresh .-> META
  RTB -. cache refresh .-> META

  RTA --> OBS
  RTB --> OBS
  A1 --> OBS
  A2 --> OBS
  B1 --> OBS
  B2 --> OBS
  WkrA --> OBS
  WkrB --> OBS
```

See `docs/` for deeper design notes and runbooks. For cloud-standards enhancements, review `docs/well-architected.md`, `docs/slo.md`, and `docs/state-machines.md`.
