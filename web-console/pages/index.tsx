import Head from "next/head";
import styles from "../styles/Home.module.css";

const tenants = [
  { id: "t-acme", name: "Acme Logistics", slaTier: "gold" },
  { id: "t-globex", name: "Globex Fleet", slaTier: "silver" },
];

const fleets = [
  { id: "f-acme-ny", tenantId: "t-acme", regions: ["us-east-1"], mode: "strong" },
  { id: "f-acme-eu", tenantId: "t-acme", regions: ["eu-west-1"], mode: "bounded" },
  { id: "f-globex-west", tenantId: "t-globex", regions: ["us-west-2"], mode: "eventual" },
];

const shards = [
  { id: "shard-a1", region: "us-east-1", fleets: ["f-acme-ny"], status: "healthy" },
  { id: "shard-b1", region: "eu-west-1", fleets: ["f-acme-eu", "f-globex-west"], status: "healthy" },
];

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>FleetShard Console</title>
      </Head>

      <main className={styles.main}>
        <h1>FleetShard Control Plane</h1>
        <p className={styles.lead}>
          Multi-region shard manager for fleet/telematics data with WAL-to-S3 replication and automated
          failover/failback. Data below is mocked for local exploration.
        </p>

        <section className={styles.panel}>
          <h2>Tenants</h2>
          <div className={styles.grid}>
            {tenants.map((tenant) => (
              <article key={tenant.id} className={styles.card}>
                <h3>{tenant.name}</h3>
                <p>ID: {tenant.id}</p>
                <p>SLA: {tenant.slaTier}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Fleets</h2>
          <div className={styles.grid}>
            {fleets.map((fleet) => (
              <article key={fleet.id} className={styles.card}>
                <h3>{fleet.id}</h3>
                <p>Tenant: {fleet.tenantId}</p>
                <p>Regions: {fleet.regions.join(", ")}</p>
                <p>Consistency: {fleet.mode}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Shard Map</h2>
          <div className={styles.grid}>
            {shards.map((shard) => (
              <article key={shard.id} className={styles.card}>
                <h3>{shard.id}</h3>
                <p>Primary region: {shard.region}</p>
                <p>Fleets: {shard.fleets.join(", ")}</p>
                <p>Status: {shard.status}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
