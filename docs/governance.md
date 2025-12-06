# Governance & Safety Workflow

## Governed actions
- Shard split/merge
- Major rebalances
- Cross-region promotions
- Durability/consistency tier upgrades

## Workflow (Plan → Simulate → Approve → Execute → Verify → Report)
- **Plan**: capture intent, policy, blast radius.
- **Simulate**: what-if latency delta, load shift, risk score, degraded-mode estimate.
- **Approve**: policy-based gates (role, region scope).
- **Execute**: state machine with checkpoints, idempotency, audit events.
- **Verify**: post-change validation (lag, latency, data checks).
- **Report**: publish outcome + logs + SLO impact.

## Events
- Emit events for all phases; store in append-only audit log; replayable for integration and cache invalidation.
