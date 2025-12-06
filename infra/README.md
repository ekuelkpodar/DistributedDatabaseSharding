# Infra (Terraform Skeleton)

Modules to build a 3-region reference deployment:

- `vpc`: multi-AZ subnets + VPC endpoints for S3/DynamoDB
- `eks`: EKS clusters for routers/workers + node groups for DB pods or DaemonSets for WAL agents
- `s3`: regional buckets with Cross-Region Replication and optional Object Lock
- `dynamodb`: global tables for shard map, node inventory, checkpoints, state machines
- `routing`: NLB per region + Route 53 / Global Accelerator
- `iam`: roles for routers, workers, control plane, and per-tenant KMS policies
- `streaming`: Kinesis/MSK for Lane A replication; KEDA autoscaling hints for worker pods
- `deploy`: progressive delivery (canary/blue-green) per region with health/SLO gates

The `main.tf` shows how to wire three regions (us-east-1, us-west-2, eu-west-1) with placeholder modules.
