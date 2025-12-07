import Fastify from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { policyInputSchema, validatePolicy } from "./policy";

type Region = "us-east-1" | "us-west-2" | "eu-west-1";

type Tier = "bronze" | "silver" | "gold";

type Tenant = {
  id: string;
  name: string;
  slaTier: Tier;
  dedicatedRouters?: boolean;
  dedicatedShards?: boolean;
  kmsKeyArn?: string;
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
  az: string;
  role: "primary" | "replica" | "standby";
  status: "healthy" | "degraded" | "unreachable";
};

type ShardMapEntry = {
  shardId: string;
  fleets: string[];
  nodes: ShardNode[];
  replicationLane: "s3-only" | "streaming+s3";
  consistencyTier: Tier;
  durabilityTier: "standard" | "enhanced" | "platinum";
  commitPolicy: "regional-quorum" | "global-quorum";
  azs: string[];
  quotas: {
    maxQps: number;
    maxStorageGb: number;
  };
};

type PolicyDocument = {
  id: string;
  durability: "standard" | "enhanced" | "platinum";
  consistency: "strong" | "bounded" | "eventual";
  residency: "us-only" | "eu-only" | "any";
  performance: { targetP95Ms: number };
  cost: { maxSpendUsd: number; autoscaleMaxNodes: number };
  operational: { approvalsRequired: boolean; approverRoles: string[] };
  version: number;
};

const tenants: Tenant[] = [
  { id: "t-acme", name: "Acme Logistics", slaTier: "gold", dedicatedRouters: true, dedicatedShards: true },
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
        az: "use1-az1",
        role: "primary",
        status: "healthy",
      },
      {
        id: "n-a1-standby",
        region: "us-west-2",
        az: "usw2-az2",
        role: "standby",
        status: "healthy",
      },
    ],
    replicationLane: "streaming+s3",
    consistencyTier: "gold",
    durabilityTier: "enhanced",
    commitPolicy: "regional-quorum",
    azs: ["use1-az1", "use1-az2", "use1-az3"],
    quotas: { maxQps: 5000, maxStorageGb: 500 },
  },
  {
    shardId: "shard-b1",
    fleets: ["f-acme-eu", "f-globex-west"],
    nodes: [
      {
        id: "n-b1-primary",
        region: "eu-west-1",
        az: "euw1-az1",
        role: "primary",
        status: "healthy",
      },
      {
        id: "n-b1-standby",
        region: "us-east-1",
        az: "use1-az3",
        role: "standby",
        status: "healthy",
      },
    ],
    replicationLane: "s3-only",
    consistencyTier: "silver",
    durabilityTier: "standard",
    commitPolicy: "regional-quorum",
    azs: ["euw1-az1", "euw1-az2", "euw1-az3"],
    quotas: { maxQps: 2000, maxStorageGb: 300 },
  },
];

const placementInputSchema = z.object({
  fleetId: z.string(),
  preferredRegions: z.array(z.string()),
  hotnessScore: z.number().int().min(0).max(100),
  residency: z.enum(["us-only", "eu-only", "any"]).default("any"),
  tier: z.enum(["bronze", "silver", "gold"]).default("silver"),
  durability: z.enum(["standard", "enhanced", "platinum"]).default("standard"),
});

const failoverRequestSchema = z.object({
  shardId: z.string(),
  promoteRegion: z.string(),
});

const rateLimitSchema = z.object({
  tenantId: z.string(),
  qps: z.number().int().min(1),
  storageGb: z.number().int().min(1),
});

const policies: PolicyDocument[] = [
  {
    id: "policy-default",
    durability: "standard",
    consistency: "bounded",
    residency: "any",
    performance: { targetP95Ms: 120 },
    cost: { maxSpendUsd: 10000, autoscaleMaxNodes: 50 },
    operational: { approvalsRequired: true, approverRoles: ["platform-admin"] },
    version: 1,
  },
];

type Event = { id: string; type: string; detail: Record<string, unknown>; ts: string };
const events: Event[] = [];

function emitEvent(type: string, detail: Record<string, unknown>) {
  events.unshift({ id: nanoid(8), type, detail, ts: new Date().toISOString() });
  if (events.length > 50) events.pop();
}

function findShardByFleet(fleetId: string): ShardMapEntry | undefined {
  return shardMap.find((entry) => entry.fleets.includes(fleetId));
}

function chooseShardForFleet({
  fleetId,
  preferredRegions,
  hotnessScore,
  residency,
  tier,
  durability,
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

  const residencyFiltered = Object.entries(regionScore).filter(([region]) => {
    if (residency === "eu-only") return region === "eu-west-1";
    if (residency === "us-only") return region === "us-east-1" || region === "us-west-2";
    return true;
  });

  const candidateRegion =
    preferredRegion ||
    (residencyFiltered.sort((a, b) => a[1] - b[1])[0]?.[0] as Region);

  const shardId = `shard-${candidateRegion}-${hotnessScore}`;
  const commitPolicy = durability === "platinum" ? "global-quorum" : "regional-quorum";
  const replicationLane = tier === "bronze" ? "s3-only" : "streaming+s3";
  const newShard: ShardMapEntry = {
    shardId,
    fleets: [fleetId],
    nodes: [
      {
        id: `${shardId}-primary`,
        region: candidateRegion,
        az: `${candidateRegion}-az1`,
        role: "primary",
        status: "healthy",
      },
      {
        id: `${shardId}-standby`,
        region: candidateRegion === "us-east-1" ? "us-west-2" : "us-east-1",
        az: candidateRegion === "us-east-1" ? "usw2-az3" : "use1-az2",
        role: "standby",
        status: "healthy",
      },
    ],
    replicationLane,
    consistencyTier: tier,
    durabilityTier: durability,
    commitPolicy,
    azs: [`${candidateRegion}-az1`, `${candidateRegion}-az2`, `${candidateRegion}-az3`],
    quotas: {
      maxQps: tier === "gold" ? 8000 : tier === "silver" ? 4000 : 1000,
      maxStorageGb: tier === "gold" ? 1000 : tier === "silver" ? 500 : 200,
    },
  };
  shardMap.push(newShard);
  emitEvent("shard.assigned", { shardId, fleetId, durability, commitPolicy });
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

  app.post("/policy", async (req, reply) => {
    const body = policyInputSchema.parse(req.body);
    const validation = validatePolicy(body);
    emitEvent("policy.updated", { policy: body });
    reply.code(201);
    return { policy: body, validation };
  });

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
    emitEvent("placement.planned", { fleetId: payload.fleetId, shardId: shard.shardId, durability: payload.durability });
    reply.code(201);
    return shard;
  });

  app.get("/shard-map", async () => shardMap);

  app.post("/failover/plan", async (req) => {
    const payload = failoverRequestSchema.parse(req.body);
    emitEvent("failover.planned", payload);
    return planFailover(payload.shardId, payload.promoteRegion);
  });

  app.post("/rate-limit", async (req) => {
    const payload = rateLimitSchema.parse(req.body);
    return {
      tenantId: payload.tenantId,
      enforced: true,
      limits: { qps: payload.qps, storageGb: payload.storageGb },
    };
  });

  app.get("/policies", async () => policies);

  app.get("/events", async () => events);

  const port = Number(process.env.PORT || 4000);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`control-plane-api listening on ${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
