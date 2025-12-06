import { z } from "zod";

const iceSinkSchema = z.object({
  shardId: z.string(),
  fleetId: z.string(),
  region: z.string(),
  payload: z.record(z.any()),
  ts: z.string(),
});

function writeIcebergSegment(record: z.infer<typeof iceSinkSchema>) {
  // Placeholder for Iceberg/Delta sink; in real system this writes Parquet + manifest.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      msg: "write-iceberg-segment",
      shardId: record.shardId,
      fleetId: record.fleetId,
      region: record.region,
      ts: record.ts,
    })
  );
}

export function handleAnalytics(record: unknown) {
  const parsed = iceSinkSchema.parse(record);
  writeIcebergSegment(parsed);
}

// Demo invocation
handleAnalytics({
  shardId: "shard-a1",
  fleetId: "f-acme-ny",
  region: "us-east-1",
  payload: { speed: 55, location: "40.71,-74.00" },
  ts: new Date().toISOString(),
});
