# Analytics Plane (Iceberg/Delta-style)

- Ingest lane: Kinesis/MSK consumer writes Parquet + Iceberg/Delta metadata to S3.
- Query layer: Athena/Trino-like engine (placeholder) queries cold/warm data without hitting OLTP shards.
- Separation: keeps analytics load off operational shard primaries; aligns with cloud-standard OLAP/OLTP split.
