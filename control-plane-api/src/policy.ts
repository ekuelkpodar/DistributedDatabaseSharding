import { z } from "zod";

export type Residency = "us-only" | "eu-only" | "any";
export type Tier = "bronze" | "silver" | "gold";

export const policyInputSchema = z.object({
  tenantId: z.string(),
  residency: z.enum(["us-only", "eu-only", "any"]).default("any"),
  tier: z.enum(["bronze", "silver", "gold"]).default("silver"),
  enforceDedicatedRouters: z.boolean().optional(),
  enforceDedicatedShards: z.boolean().optional(),
});

export type Policy = z.infer<typeof policyInputSchema>;

export function validatePolicy(policy: Policy) {
  if (policy.tier === "gold" && policy.residency === "any") {
    // For gold we prefer explicit residency for compliance clarity.
    return { ok: true, note: "gold tier without residency; defaulting to global placement" };
  }
  return { ok: true };
}
