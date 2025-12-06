# Data Models

## DynamoDB (control plane)
- `Tenants`: `tenantId (PK)`, `name`, `slaTier`, `createdAt`.
- `Fleets`: `tenantId (PK)`, `fleetId (SK)`, `preferredRegions`, `consistency`, `policy`.
- `ShardMap`: `fleetId (PK)`, `shardId`, `nodeGroup`, `primaryRegion`, `replicas`, `standbyRegion`.
- `Nodes`: `nodeId (PK)`, `shardId`, `region`, `role`, `status`, `lsn`.
- `WALManifests`: `shardId (PK)`, `ts (SK)`, `segmentUri`, `sizeBytes`, `checksum`.
- `ReplicationCheckpoints`: `shardId (PK)`, `region (SK)`, `lastSegment`, `lsn`.
- `Incidents`: `incidentId (PK)`, `shardId`, `severity`, `status`, `timeline`.
- `RebalancePlans`: `planId (PK)`, `shardId`, `state`, `steps`.

## Postgres shard schema (per shard)
- `tenants` (optional caching of tenant metadata)
- `vehicles(id, tenant_id, fleet_id, vin, metadata, created_at)`
- `drivers(id, tenant_id, fleet_id, name, license_no, created_at)`
- `assignments(id, vehicle_id, driver_id, started_at, ended_at)`
- `telemetry_events(id, vehicle_id, fleet_id, ts timestamptz, location, speed, payload jsonb) PARTITION BY RANGE (ts)`
- `maintenance_records(id, vehicle_id, opened_at, closed_at, details jsonb)`
- `trip_summaries(id, vehicle_id, fleet_id, period, distance_km, fuel_liters, avg_speed)`

## S3 layout
- `s3://<region>/fleetshard/wal/<shardId>/<ts>/segment-<seq>.wal`
- `s3://<region>/fleetshard/manifests/<shardId>/<ts>.json`
- `s3://<region>/fleetshard/checkpoints/<shardId>/<region>.json`
