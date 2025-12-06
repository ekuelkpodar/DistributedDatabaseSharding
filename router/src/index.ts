import Fastify from "fastify";
import { z } from "zod";

type Region = "us-east-1" | "us-west-2" | "eu-west-1";

type ShardNode = {
  id: string;
  region: Region;
  role: "primary" | "replica" | "standby";
  status: "healthy" | "degraded" | "unreachable";
};

type ShardMapEntry = {
  shardId: string;
  fleets: string[];
  nodes: ShardNode[];
};

type CachedMap = {
  updatedAt: number;
  data: ShardMapEntry[];
};

const routeInputSchema = z.object({
  tenantId: z.string(),
  fleetId: z.string(),
  op: z.enum(["read", "write"]),
  regionHint: z.string().optional(),
  consistency: z.enum(["strong", "bounded", "eventual"]).default("bounded"),
  requestId: z.string().optional(),
});

let cached: CachedMap | undefined;
const CACHE_TTL_MS = 5000;
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || "http://localhost:4000";

async function fetchShardMap(): Promise<ShardMapEntry[]> {
  const shouldRefresh =
    !cached || Date.now() - cached.updatedAt > CACHE_TTL_MS;

  if (!shouldRefresh && cached) {
    return cached.data;
  }

  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/shard-map`);
    if (!res.ok) {
      throw new Error(`control-plane status ${res.status}`);
    }
    const data = (await res.json()) as ShardMapEntry[];
    cached = { data, updatedAt: Date.now() };
    return data;
  } catch (err) {
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}

function chooseNode(entry: ShardMapEntry, op: "read" | "write", consistency: string, regionHint?: string) {
  const healthy = entry.nodes.filter((n) => n.status === "healthy");
  if (op === "write" || consistency === "strong") {
    return healthy.find((n) => n.role === "primary") || entry.nodes[0];
  }

  if (regionHint) {
    const regional = healthy.find((n) => n.region === regionHint && n.role !== "standby");
    if (regional) return regional;
  }

  const replica = healthy.find((n) => n.role === "replica");
  if (replica) return replica;
  return healthy[0] || entry.nodes[0];
}

async function start() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/route", async (req, reply) => {
    const input = routeInputSchema.parse(req.body);
    const map = await fetchShardMap();
    const shard = map.find((s) => s.fleets.includes(input.fleetId));

    if (!shard) {
      reply.code(404);
      return { error: "fleet-not-found" };
    }

    const node = chooseNode(shard, input.op, input.consistency, input.regionHint);
    return {
      shardId: shard.shardId,
      targetNode: node.id,
      region: node.region,
      role: node.role,
      cacheAgeMs: cached ? Date.now() - cached.updatedAt : undefined,
      consistencyTier: shard.consistencyTier,
      replicationLane: shard.replicationLane,
      requestId: input.requestId || `req-${Date.now()}`,
    };
  });

  const port = Number(process.env.PORT || 4100);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`router listening on ${port}`);
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
