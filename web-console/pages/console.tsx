import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../styles/Home.module.css";

type ShardStatus = {
  id: string;
  primaryRegion: string;
  standbyRegion: string;
  consistencyTier: "bronze" | "silver" | "gold";
  replicationLane: "s3-only" | "streaming+s3";
  walBacklog: number;
  replicaLag: number;
  state: "healthy" | "promoting" | "verifying" | "degraded";
  fleets: string[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const routerBase = process.env.NEXT_PUBLIC_ROUTER_BASE || "http://localhost:4100";

const initialShards: ShardStatus[] = [
  {
    id: "shard-a1",
    primaryRegion: "us-east-1",
    standbyRegion: "us-west-2",
    consistencyTier: "gold",
    replicationLane: "streaming+s3",
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
    walBacklog: 6,
    replicaLag: 5,
    state: "healthy",
    fleets: ["f-acme-eu", "f-globex-west"],
  },
];

export default function ConsolePage() {
  const [shards, setShards] = useState<ShardStatus[]>(initialShards);
  const [log, setLog] = useState<string[]>([]);
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
            <h2>Event Stream</h2>
            <p className={styles.subtle}>Recent control-plane operations.</p>
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
