import Queue from "p-queue";

type Shard = {
  shardId: string;
  primaryRegion: string;
  standbyRegion: string;
  walBacklog: number;
  replicaLagSeconds: number;
};

const shards: Shard[] = [
  {
    shardId: "shard-a1",
    primaryRegion: "us-east-1",
    standbyRegion: "us-west-2",
    walBacklog: 3,
    replicaLagSeconds: 2,
  },
  {
    shardId: "shard-b1",
    primaryRegion: "eu-west-1",
    standbyRegion: "us-east-1",
    walBacklog: 6,
    replicaLagSeconds: 5,
  },
];

type WorkerRole = "replication" | "recovery" | "health" | "rebalance";
const role = (process.env.WORKER_ROLE as WorkerRole) || "replication";

const queue = new Queue({ concurrency: 2 });

function log(msg: string, shardId?: string) {
  // Simple structured log
  const payload = { ts: new Date().toISOString(), role, msg, shardId };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

async function replicate(shard: Shard) {
  log("upload wal segment to S3", shard.shardId);
  await new Promise((r) => setTimeout(r, 150));
  shard.walBacklog = Math.max(0, shard.walBacklog - 1);
}

async function recover(shard: Shard) {
  log("apply wal from replicated manifest", shard.shardId);
  await new Promise((r) => setTimeout(r, 200));
  shard.replicaLagSeconds = Math.max(0, shard.replicaLagSeconds - 1);
}

async function checkHealth(shard: Shard) {
  const degraded = shard.replicaLagSeconds > 10 || shard.walBacklog > 15;
  log(degraded ? "health degraded" : "health ok", shard.shardId);
}

async function rebalance(shard: Shard) {
  log("evaluate placement for hot shard", shard.shardId);
}

async function tick() {
  for (const shard of shards) {
    queue.add(async () => {
      if (role === "replication") return replicate(shard);
      if (role === "recovery") return recover(shard);
      if (role === "health") return checkHealth(shard);
      return rebalance(shard);
    });
  }
}

setInterval(tick, 1000);
log("worker started");
