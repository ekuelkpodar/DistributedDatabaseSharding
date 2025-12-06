import Fastify from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";

type Region = "us-east-1" | "us-west-2" | "eu-west-1";

type Tenant = {
  id: string;
  name: string;
  slaTier: "gold" | "silver" | "bronze";
};

type Fleet = {
  id: string;
  tenantId: string;
  name: string;
  preferredRegions: Region[];
  consistency: "strong" | "bounded" | "eventual";
};

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

const tenants: Tenant[] = [
  { id: "t-acme", name: "Acme Logistics", slaTier: "gold" },
  { id: "t-globex", name: "Globex Fleet", slaTier: "silver" },
];

const fleets: Fleet[] = [
  {
    id: "f-acme-ny",
    tenantId: "t-acme",
    name: "Acme NY",
    preferredRegions: ["us-east-1"],
    consistency: "strong",
  },
  {
    id: "f-acme-eu",
    tenantId: "t-acme",
    name: "Acme EU",
    preferredRegions: ["eu-west-1"],
    consistency: "bounded",
  },
  {
    id: "f-globex-west",
    tenantId: "t-globex",
    name: "Globex West",
    preferredRegions: ["us-west-2"],
    consistency: "eventual",
  },
];

const shardMap: ShardMapEntry[] = [
  {
    shardId: "shard-a1",
    fleets: ["f-acme-ny"],
    nodes: [
      {
        id: "n-a1-primary",
        region: "us-east-1",
        role: "primary",
        status: "healthy",
      },
      {
        id: "n-a1-standby",
        region: "us-west-2",
        role: "standby",
        status: "healthy",
      },
    ],
  },
  {
    shardId: "shard-b1",
    fleets: ["f-acme-eu", "f-globex-west"],
    nodes: [
      {
        id: "n-b1-primary",
        region: "eu-west-1",
        role: "primary",
        status: "healthy",
      },
      {
        id: "n-b1-standby",
        region: "us-east-1",
        role: "standby",
        status: "healthy",
      },
    ],
  },
];

const placementInputSchema = z.object({
  fleetId: z.string(),
  preferredRegions: z.array(z.string()),
  hotnessScore: z.number().int().min(0).max(100),
});

const failoverRequestSchema = z.object({
  shardId: z.string(),
  promoteRegion: z.string(),
});

function findShardByFleet(fleetId: string): ShardMapEntry | undefined {
  return shardMap.find((entry) => entry.fleets.includes(fleetId));
}

function chooseShardForFleet({
  fleetId,
  preferredRegions,
  hotnessScore,
}: z.infer<typeof placementInputSchema>): ShardMapEntry {
  const existing = findShardByFleet(fleetId);
  if (existing) {
    return existing;
  }

  // Toy placement engine: prefer region capacity then hotness spread.
  const regionScore: Record<Region, number> = {
    "us-east-1": 0,
    "us-west-2": 0,
    "eu-west-1": 0,
  };
  shardMap.forEach((entry) => {
    entry.nodes.forEach((node) => {
      regionScore[node.region] += entry.fleets.length;
    });
  });

  const preferredRegion = preferredRegions.find(
    (r): r is Region => r === "us-east-1" || r === "us-west-2" || r === "eu-west-1"
  );

  const candidateRegion =
    preferredRegion ||
    (Object.entries(regionScore).sort((a, b) => a[1] - b[1])[0]?.[0] as Region);

  const shardId = `shard-${candidateRegion}-${hotnessScore}`;
  const newShard: ShardMapEntry = {
    shardId,
    fleets: [fleetId],
    nodes: [
      {
        id: `${shardId}-primary`,
        region: candidateRegion,
        role: "primary",
        status: "healthy",
      },
      {
        id: `${shardId}-standby`,
        region: candidateRegion === "us-east-1" ? "us-west-2" : "us-east-1",
        role: "standby",
        status: "healthy",
      },
    ],
  };
  shardMap.push(newShard);
  return newShard;
}

function planFailover(shardId: string, promoteRegion: string) {
  const shard = shardMap.find((s) => s.shardId === shardId);
  if (!shard) {
    throw new Error(`Shard ${shardId} not found`);
  }
  return {
    shardId,
    promoteRegion,
    steps: [
      "detect: monitor health + lag",
      "declare: mark primary degraded",
      `promote: elect standby in ${promoteRegion}`,
      "update-map: write shard map atomically",
      "verify: check LSN alignment + serve",
    ],
  };
}

async function main() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/tenants", async () => tenants);

  app.post("/tenants", async (req, reply) => {
    const body = z
      .object({ name: z.string().min(1), slaTier: z.enum(["gold", "silver", "bronze"]) })
      .parse(req.body);
    const tenant: Tenant = { id: `t-${nanoid(6)}`, ...body };
    tenants.push(tenant);
    reply.code(201);
    return tenant;
  });

  app.get("/fleets", async (req) => {
    const tenantId = (req.query as { tenantId?: string }).tenantId;
    return tenantId ? fleets.filter((f) => f.tenantId === tenantId) : fleets;
  });

  app.post("/placement/plan", async (req, reply) => {
    const payload = placementInputSchema.parse(req.body);
    const shard = chooseShardForFleet(payload);
    reply.code(201);
    return shard;
  });

  app.get("/shard-map", async () => shardMap);

  app.post("/failover/plan", async (req) => {
    const payload = failoverRequestSchema.parse(req.body);
    return planFailover(payload.shardId, payload.promoteRegion);
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`control-plane-api listening on ${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
