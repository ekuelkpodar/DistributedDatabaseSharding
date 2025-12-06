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
- `infra/` – Terraform skeleton for multi-region AWS deployment
- `docs/` – architecture notes, data models, runbooks

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
    subgraph DbsA[Shard DB Nodes]
      A1[(Shard A-1 Primary)]
      A2[(Shard A-2 Primary)]
      AR1[(Read Replicas)]
    end
    CdcA[WAL/CDC Agent]
    WkrA[Replication Workers]
    S3A[(S3 Bucket A)]
  end

  subgraph RegionB[AWS Region B]
    RTB[Shard Router Cluster]
    subgraph DbsB[Warm Standby Nodes]
      B1[(Shard A-1 Standby)]
      B2[(Shard A-2 Standby)]
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

  RTA --> A1
  RTA --> A2
  RTA --> AR1

  CdcA --> WkrA --> S3A
  S3A -- CRR --> S3B
  S3B --> WkrB --> B1
  S3B --> WkrB --> B2

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

See `docs/` for deeper design notes and runbooks.
