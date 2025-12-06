import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Home.module.css";

const highlights = [
  "Control plane + data plane separation with DynamoDB Global Tables",
  "Two-lane replication: streaming (Kinesis/MSK) + S3 CRR archive",
  "State-machine orchestration for failover/failback/split",
  "Per-tenant isolation, quotas, and optional dedicated router/shard pools",
  "OpenTelemetry everywhere: traces, metrics, structured audit logs",
];

const pillars = [
  { title: "Reliability", body: "99.95% write availability, replica-lag SLOs, automated failover with cache TTL safeguards." },
  { title: "Performance", body: "Region-aware routing, bounded-staleness reads, hot-shard split and dedicated pools for heavy fleets." },
  { title: "Security", body: "KMS per tenant tier, IAM least privilege, audit trails for shard moves and policy changes." },
  { title: "Cost & Ops", body: "Tiered replication SKUs, cold data lake for analytics, progressive delivery with budget guards." },
];

const tiers = [
  { name: "Standard", rpo: "≤5m", rto: "≤15m", lane: "Regional sync quorum + async cross-region", notes: "Low latency; small RPO on region loss" },
  { name: "Enhanced", rpo: "≈ seconds", rto: "≤5m", lane: "Sync AZ quorum + streaming cross-region + S3 archive", notes: "Very low RPO; immutable WAL archive" },
  { name: "Platinum", rpo: "near-zero", rto: "≤2m", lane: "Global quorum commit (optional) + streaming + S3", notes: "Higher latency; explicit SLA tradeoffs" },
];

const checklist = [
  "Placement engine v2 with residency, cost, and hotness scoring",
  "Failover/failback state machines with verification gates",
  "Analytics plane to offload OLTP (Iceberg/Delta on S3)",
  "Policy-as-code for data residency and SLO tiers",
  "Progressive delivery: canary/blue-green per region",
];

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>FleetShard | Global Sharding for Fleet Data</title>
      </Head>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>FleetShard • Multi-region sharding platform</p>
            <h1>Ship fleet data globally with hyperscaler discipline.</h1>
            <p className={styles.lead}>
              Control plane + data plane separation, two-lane replication, state-machine failovers, and observability-first
              operations for 500–1000 database nodes across AWS regions.
            </p>
            <div className={styles.actions}>
              <Link href="/console" className={styles.button}>
                Open Control Console
              </Link>
              <a className={styles.buttonGhost} href="https://github.com/ekuelkpodar/DistributedDatabaseSharding" target="_blank" rel="noreferrer">
                View Repo & Docs
              </a>
            </div>
            <div className={styles.badges}>
              <span className={styles.pill}>Two-lane replication</span>
              <span className={styles.pill}>Control/Data separation</span>
              <span className={styles.pill}>OTel-native</span>
            </div>
          </div>
          <div className={styles.heroCard}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.subtle}>Live posture</p>
                <h3>Global Health</h3>
              </div>
              <span className={styles.pill}>Active-Active</span>
            </div>
            <div className={styles.statRow}>
              <span>Regions online</span>
              <strong>3/3</strong>
            </div>
            <div className={styles.statRow}>
              <span>Replica lag (p95)</span>
              <strong>3.2s</strong>
            </div>
            <div className={styles.statRow}>
              <span>WAL backlog</span>
              <strong>9 segments</strong>
            </div>
            <p className={styles.subtle}>Designed for 500–1000 Postgres shard nodes with automated placement and failover.</p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Why FleetShard</h2>
            <p className={styles.subtle}>Cloud-standard patterns for mission-critical fleet/telematics data.</p>
          </div>
          <div className={styles.featureGrid}>
            {highlights.map((item) => (
              <div key={item} className={styles.featureCard}>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Well-Architected Pillars</h2>
            <p className={styles.subtle}>Reliability, performance, security, and operational excellence baked in.</p>
          </div>
          <div className={styles.grid}>
            {pillars.map((p) => (
              <article key={p.title} className={styles.card}>
                <h3>{p.title}</h3>
                <p className={styles.subtle}>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Resiliency Tiers & Replication</h2>
            <p className={styles.subtle}>Pick your RPO/RTO and replication lane. S3 is always the authoritative archive.</p>
          </div>
          <div className={styles.tierGrid}>
            {tiers.map((tier) => (
              <div key={tier.name} className={styles.tierCard}>
                <header className={styles.cardHead}>
                  <h3>{tier.name}</h3>
                  <span className={styles.pill}>{tier.lane}</span>
                </header>
                <p className={styles.subtle}>RPO {tier.rpo} · RTO {tier.rto}</p>
                <p>{tier.notes}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>What ships in v2</h2>
            <p className={styles.subtle}>Everything you expect from a Tier-1 cloud-native database fabric.</p>
          </div>
          <div className={styles.listColumns}>
            <ul>
              {checklist.slice(0, Math.ceil(checklist.length / 2)).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <ul>
              {checklist.slice(Math.ceil(checklist.length / 2)).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Control Plane vs Data Plane</h2>
            <p className={styles.subtle}>Separation reduces blast radius and keeps ops predictable.</p>
          </div>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>Control Plane</h3>
              <p className={styles.subtle}>Fastify API, DynamoDB Global Tables, SQS/KEDA workers, audit, policy-as-code.</p>
              <p>Placement engine, shard map, failover/failback state machines, quotas, billing hooks.</p>
            </div>
            <div className={styles.featureCard}>
              <h3>Data Plane</h3>
              <p className={styles.subtle}>Routers in each region, shard node groups, WAL/CDC agents, caches.</p>
              <p>Read/write routing, bounded staleness, per-tenant isolation, circuit breakers, per-region health.</p>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Ready to explore?</h2>
            <p className={styles.subtle}>Open the live console (mocked) or browse the architecture docs.</p>
          </div>
          <div className={styles.actions}>
            <Link href="/console" className={styles.button}>
              Launch Console
            </Link>
            <a className={styles.buttonGhost} href="https://github.com/ekuelkpodar/DistributedDatabaseSharding/blob/main/docs/architecture.md" target="_blank" rel="noreferrer">
              Read Architecture Docs
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
