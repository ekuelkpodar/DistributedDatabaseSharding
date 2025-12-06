import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../styles/Home.module.css";

type ShardStatus = {
  id: string;
  primaryRegion: string;
  standbyRegion: string;
  consistencyTier: "bronze" | "silver" | "gold";
  replicationLane: "s3-only" | "streaming+s3";
  durabilityTier?: "standard" | "enhanced" | "platinum";
  commitPolicy?: "regional-quorum" | "global-quorum";
  walBacklog: number;
  replicaLag: number;
  state: "healthy" | "promoting" | "verifying" | "degraded";
  fleets: string[];
};

type PolicyDoc = {
  id: string;
  durability: string;
  consistency: string;
  residency: string;
  performance: { targetP95Ms: number };
  cost: { maxSpendUsd: number; autoscaleMaxNodes: number };
  operational: { approvalsRequired: boolean; approverRoles: string[] };
  version: number;
};

type EventRecord = { id: string; type: string; detail: Record<string, unknown>; ts: string };

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const routerBase = process.env.NEXT_PUBLIC_ROUTER_BASE || "http://localhost:4100";

const initialShards: ShardStatus[] = [
  {
    id: "shard-a1",
    primaryRegion: "us-east-1",
    standbyRegion: "us-west-2",
    consistencyTier: "gold",
    replicationLane: "streaming+s3",
    durabilityTier: "enhanced",
    commitPolicy: "regional-quorum",
    walBacklog: 3,
    replicaLag: 2,
    state: "healthy",
    fleets: ["f-acme-ny"],
  },
  {
    id: "shard-b1",
    primaryRegion: "eu-west-1",
    standbyRegion: "us-east-1",
    consistencyTier: "silver",
    replicationLane: "s3-only",
    durabilityTier: "standard",
    commitPolicy: "regional-quorum",
    walBacklog: 6,
    replicaLag: 5,
    state: "healthy",
    fleets: ["f-acme-eu", "f-globex-west"],
  },
];

export default function ConsolePage() {
  const [shards, setShards] = useState<ShardStatus[]>(initialShards);
  const [log, setLog] = useState<string[]>([]);
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<string>("");
  const [placingFleet, setPlacingFleet] = useState({ fleetId: "f-new", regions: "us-east-1" });

  useEffect(() => {
    const interval = setInterval(() => {
      setShards((prev) =>
        prev.map((s) => {
          const drift = Math.max(0, s.walBacklog + (Math.random() > 0.7 ? 1 : -1));
          const lag = Math.max(0, s.replicaLag + (Math.random() > 0.75 ? 1 : -1));
          return { ...s, walBacklog: drift, replicaLag: lag };
        })
      );
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const scoreColor = (val: number, warn: number, danger: number) => {
    if (val >= danger) return "#ff6b6b";
    if (val >= warn) return "#ffce73";
    return "#5ee2a0";
  };

  const handlePlacement = async (e: FormEvent) => {
    e.preventDefault();
    const regions = placingFleet.regions.split(",").map((r) => r.trim());
    const body = { fleetId: placingFleet.fleetId, preferredRegions: regions, hotnessScore: 50 };
    try {
      const res = await fetch(`${apiBase}/placement/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLog((l) => [`Planned shard ${data.shardId} for ${body.fleetId}`, ...l].slice(0, 6));
    } catch (err) {
      setLog((l) => [`Placement failed: ${String(err)}`, ...l].slice(0, 6));
    }
  };

  const handleFailover = async (shardId: string, promoteRegion: string) => {
    try {
      const res = await fetch(`${apiBase}/failover/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shardId, promoteRegion }),
      });
      const data = await res.json();
      setLog((l) => [`Failover plan for ${shardId} -> ${promoteRegion}: ${data.steps.length} steps`, ...l].slice(0, 6));
      setShards((prev) =>
        prev.map((s) =>
          s.id === shardId
            ? { ...s, state: "promoting", primaryRegion: promoteRegion, replicaLag: Math.max(0, s.replicaLag - 1) }
            : s
        )
      );
    } catch (err) {
      setLog((l) => [`Failover plan failed: ${String(err)}`, ...l].slice(0, 6));
    }
  };

  const handleRouteProbe = async () => {
    try {
      const res = await fetch(`${routerBase}/route`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: "t-acme", fleetId: "f-acme-ny", op: "write" }),
      });
      const data = await res.json();
      setRouteResult(`→ ${data.targetNode} (${data.region}) lane=${data.replicationLane}`);
      setLog((l) => [`Route probe hit ${data.targetNode}`, ...l].slice(0, 6));
    } catch (err) {
      setRouteResult(`probe failed: ${String(err)}`);
    }
  };

  const refreshPolicies = async () => {
    try {
      const res = await fetch(`${apiBase}/policies`);
      const data = await res.json();
      setPolicies(data);
      setPolicyError(null);
    } catch (err) {
      setPolicyError("Could not reach control-plane API. Start npm run dev:api and try again.");
      setLog((l) => [`Policy fetch failed: ${String(err)}`, ...l].slice(0, 8));
    }
  };

  const refreshEvents = async () => {
    try {
      const res = await fetch(`${apiBase}/events`);
      const data = await res.json();
      setEvents(data);
      setEventError(null);
    } catch (err) {
      setEventError("Could not reach control-plane API. Start npm run dev:api and try again.");
      setLog((l) => [`Event fetch failed: ${String(err)}`, ...l].slice(0, 8));
    }
  };

  const handleAwsAction = (action: string) => {
    setLog((l) => [`AWS helper: ${action}`, ...l].slice(0, 8));
  };

  const aggregate = useMemo(() => {
    const wal = shards.reduce((acc, s) => acc + s.walBacklog, 0);
    const lag = shards.reduce((acc, s) => acc + s.replicaLag, 0);
    const degraded = shards.filter((s) => s.state !== "healthy").length;
    return { wal, lag, degraded };
  }, [shards]);

  return (
    <div className={styles.container}>
      <Head>
        <title>FleetShard Console</title>
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>FleetShard v2 · Control & Observe</p>
            <h1>Global Sharding Control Plane</h1>
            <p className={styles.lead}>
              Manage shards, replication lanes, failover state machines, and routing decisions across regions. Backend
              calls target local Fastify mocks (`{apiBase}` / `{routerBase}`).
            </p>
          </div>
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <span>WAL backlog</span>
              <strong style={{ color: scoreColor(aggregate.wal, 10, 20) }}>{aggregate.wal}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Replica lag (s)</span>
              <strong style={{ color: scoreColor(aggregate.lag, 8, 15) }}>{aggregate.lag}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Degraded shards</span>
              <strong style={{ color: scoreColor(aggregate.degraded, 1, 3) }}>{aggregate.degraded}</strong>
            </div>
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Backend Control</h2>
            <p className={styles.subtle}>Drive control-plane actions against the mock API.</p>
          </div>
          <div className={styles.controlsGrid}>
            <form onSubmit={handlePlacement} className={styles.controlCard}>
              <p className={styles.label}>Plan placement</p>
              <label>
                Fleet ID
                <input
                  className={styles.input}
                  value={placingFleet.fleetId}
                  onChange={(e) => setPlacingFleet((p) => ({ ...p, fleetId: e.target.value }))}
                  required
                />
              </label>
              <label>
                Preferred regions (csv)
                <input
                  className={styles.input}
                  value={placingFleet.regions}
                  onChange={(e) => setPlacingFleet((p) => ({ ...p, regions: e.target.value }))}
                  required
                />
              </label>
              <button className={styles.button} type="submit">Plan shard</button>
            </form>

            <div className={styles.controlCard}>
              <p className={styles.label}>Failover planner</p>
              <p className={styles.subtle}>Runs /failover/plan on control plane.</p>
              <div className={styles.inlineActions}>
                {shards.map((s) => (
                  <button className={styles.button} key={s.id} onClick={() => handleFailover(s.id, s.standbyRegion)}>
                    {s.id} → {s.standbyRegion}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlCard}>
              <p className={styles.label}>Router probe</p>
              <p className={styles.subtle}>Hit /route to verify cache + lane selection.</p>
              <button className={styles.button} onClick={handleRouteProbe}>Send probe</button>
              <code className={styles.code}>{routeResult || "awaiting probe..."}</code>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Shard Map & Health</h2>
            <p className={styles.subtle}>Live view of shard roles, replication lanes, and backlog.</p>
          </div>
          <div className={styles.grid}>
            {shards.map((shard) => (
              <article key={shard.id} className={styles.card}>
                <header className={styles.cardHead}>
                  <div>
                    <h3>{shard.id}</h3>
                    <p className={styles.subtle}>
                      Primary {shard.primaryRegion} · Standby {shard.standbyRegion}
                    </p>
                  </div>
                  <span className={styles.pill}>{shard.consistencyTier}</span>
                </header>
                <p className={styles.subtle}>Fleets: {shard.fleets.join(", ")}</p>
                <div className={styles.statRow}>
                  <span>Replication lane</span>
                  <strong>{shard.replicationLane}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Durability tier</span>
                  <strong>{shard.durabilityTier || "standard"}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>Commit policy</span>
                  <strong>{shard.commitPolicy || "regional-quorum"}</strong>
                </div>
                <div className={styles.statRow}>
                  <span>WAL backlog</span>
                  <div className={styles.bar}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${Math.min(100, shard.walBacklog * 5)}%`, background: scoreColor(shard.walBacklog, 8, 15) }}
                    />
                    <span>{shard.walBacklog}</span>
                  </div>
                </div>
                <div className={styles.statRow}>
                  <span>Replica lag (s)</span>
                  <div className={styles.bar}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${Math.min(100, shard.replicaLag * 10)}%`, background: scoreColor(shard.replicaLag, 6, 10) }}
                    />
                    <span>{shard.replicaLag}</span>
                  </div>
                </div>
                <div className={styles.statRow}>
                  <span>State</span>
                  <strong className={styles.state}>{shard.state}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Policies & Governance</h2>
            <p className={styles.subtle}>Policy-as-code surface and recent platform events.</p>
          </div>
          <div className={styles.controlsGrid}>
            <div className={styles.controlCard}>
              <p className={styles.label}>Policies</p>
              <p className={styles.subtle}>Durability/consistency/residency/cost per policy.</p>
              <button className={styles.button} onClick={refreshPolicies}>Refresh policies</button>
              {policyError && <p className={styles.subtle}>{policyError}</p>}
              <div className={styles.logBox}>
                {policies.length === 0 && <p className={styles.subtle}>No policies loaded.</p>}
                {policies.map((p) => (
                  <div key={p.id} className={styles.logLine}>
                    {p.id} v{p.version} · dur={p.durability} · cons={p.consistency} · resid={p.residency} · p95={p.performance.targetP95Ms}ms
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.controlCard}>
              <p className={styles.label}>Events</p>
              <p className={styles.subtle}>Last 50 control-plane events (mock).</p>
              <button className={styles.button} onClick={refreshEvents}>Refresh events</button>
              {eventError && <p className={styles.subtle}>{eventError}</p>}
              <div className={styles.logBox}>
                {events.length === 0 && <p className={styles.subtle}>No events yet.</p>}
                {events.map((e) => (
                  <div key={e.id} className={styles.logLine}>
                    {e.ts} · {e.type} · {JSON.stringify(e.detail)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>AWS helper actions (mocked)</h2>
            <p className={styles.subtle}>Quick shortcuts you might wire to AWS APIs/CloudFormation/Terraform.</p>
          </div>
          <div className={styles.controlsGrid}>
            <div className={styles.controlCard}>
              <p className={styles.label}>Resiliency</p>
              <div className={styles.inlineActions}>
                <button className={styles.button} onClick={() => handleAwsAction("Provision S3 bucket with CRR + Object Lock")}>S3 CRR + Object Lock</button>
                <button className={styles.button} onClick={() => handleAwsAction("Deploy Kinesis stream for streaming lane")}>Create Kinesis stream</button>
                <button className={styles.button} onClick={() => handleAwsAction("Provision Redis/ElastiCache for regional cache")}>Add Redis cache</button>
              </div>
            </div>
            <div className={styles.controlCard}>
              <p className={styles.label}>Shard capacity</p>
              <div className={styles.inlineActions}>
                <button className={styles.button} onClick={() => handleAwsAction("Scale EKS node group for shard pool")}>Scale shard pool</button>
                <button className={styles.button} onClick={() => handleAwsAction("Allocate dedicated shard for hot fleet")}>Create dedicated shard</button>
              </div>
            </div>
            <div className={styles.controlCard}>
              <p className={styles.label}>Routing & DNS</p>
              <div className={styles.inlineActions}>
                <button className={styles.button} onClick={() => handleAwsAction("Update Route53 failover records for routers")}>Update Route53</button>
                <button className={styles.button} onClick={() => handleAwsAction("Refresh router cache via event bus")}>Refresh router cache</button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Local event stream</h2>
            <p className={styles.subtle}>Console actions log (placement, failover, probes, helper actions).</p>
          </div>
          <div className={styles.logBox}>
            {log.length === 0 && <p className={styles.subtle}>No events yet. Trigger placement/failover to see activity.</p>}
            {log.map((line, i) => (
              <div key={i} className={styles.logLine}>
                {line}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
